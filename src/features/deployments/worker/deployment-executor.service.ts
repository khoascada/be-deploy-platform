import { DeploymentCommandError } from '@/features/deployments/worker/deployment-command-runner.service';
import { DeploymentLogWriter } from '@/features/deployments/worker/deployment-log-writer';
import { DeploymentRuntimeService } from '@/features/deployments/worker/deployment-runtime.service';
import { DeploymentSourceService } from '@/features/deployments/worker/deployment-source.service';
import { DeploymentLogPublisherService } from '@/features/deployments/shared/deployment-log-publisher.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import type { DeploymentFailureInput } from '@/features/deployments/shared/deployment.types';
import { Injectable, Logger } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';

@Injectable()
export class DeploymentExecutorService {
  private readonly logger = new Logger(DeploymentExecutorService.name);

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly source: DeploymentSourceService,
    private readonly runtime: DeploymentRuntimeService,
    private readonly publisher: DeploymentLogPublisherService,
  ) {}

  async execute(deploymentId: string) {
    const context = await this.deployments.claimQueuedDeployment(deploymentId);

    if (!context) {
      this.logger.warn(
        `Skipping deployment ${deploymentId} because it is no longer claimable`,
      );
      return;
    }

    const logWriter = new DeploymentLogWriter(
      this.deployments,
      context,
      this.publisher,
    );

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