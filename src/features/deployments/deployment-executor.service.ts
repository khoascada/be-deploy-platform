import { Injectable, Logger } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';
import { DeploymentCommandError } from './deployment-command-runner.service';
import { DeploymentLogWriter } from './deployment-log-writer';
import { DeploymentRepository } from './deployment.repository';
import { DeploymentRuntimeService } from './deployment-runtime.service';
import { DeploymentSourceService } from './deployment-source.service';
import type { DeploymentFailureInput } from './deployment.types';

// Logic xử lý worker
@Injectable()
export class DeploymentExecutorService {
  private readonly logger = new Logger(DeploymentExecutorService.name);

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly source: DeploymentSourceService,
    private readonly runtime: DeploymentRuntimeService,
  ) {}

  // Hàm thực thi worker
  async execute(deploymentId: string) {
    const context = await this.deployments.claimQueuedDeployment(deploymentId);


    if (!context) {
      this.logger.warn(
        `Skipping deployment ${deploymentId} because it is no longer claimable`,
      );
      return;
    }

    const logWriter = new DeploymentLogWriter(this.deployments, context);

    try {
      await logWriter.system(
        `Starting deployment #${context.deploymentNumber} for project ${context.project.slug}`,
      );

      const repoPath = await this.source.prepareRepository(context, logWriter);

      const imageTag = this.runtime.buildImageTag(context);

      await this.deployments.updateStatus(
        context.id,
        DeploymentStatus.BUILDING,
      );
      
      await logWriter.system(`Building Docker image ${imageTag}`);
      await this.runtime.buildDockerImage(
        context,
        repoPath,
        imageTag,
        logWriter,
      );

      await this.deployments.updateStatus(
        context.id,
        DeploymentStatus.DEPLOYING,
        {
          imageTag,
        },
      );
      await logWriter.system(
        `Deploying container ${context.project.containerName}`,
      );
      const containerId = await this.runtime.deployContainer(
        context,
        imageTag,
        logWriter,
      );

      await logWriter.system(
        `Deployment finished successfully with container ${containerId}`,
      );
      await logWriter.flush();
      await this.deployments.markSuccess(context.id, { imageTag, containerId });
    } catch (error) {
      const failure = toFailureInput(error);
      await logWriter.error(`Deployment failed: ${failure.errorMessage}`);
      await logWriter.flush();
      await this.deployments.markFailed(context.id, failure);
      throw error;
    }
  }
}

function toFailureInput(error: unknown): DeploymentFailureInput {
  if (error instanceof DeploymentCommandError) {
    const stderr = error.result.stderr.trim();
    const stdout = error.result.stdout.trim();

    return {
      errorMessage: stderr || stdout || error.message,
    };
  }

  return {
    errorMessage: getErrorMessage(error),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown deployment error';
}
