import { DeploymentRealtimePublisherService } from '@/features/deployments/shared/deployment-realtime-publisher.service';
import { DeploymentDispatchService } from '@/features/deployments/shared/deployment-dispatch.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import type { DeploymentFailureInput } from '@/features/deployments/shared/deployment.types';
import { toDeploymentStatusChangedEvent } from '@/features/deployments/shared/types/deployment-status-events';
import { DeploymentCommandError } from '@/features/deployments/worker/deployment-command-runner.service';
import { DeploymentLogWriter } from '@/features/deployments/worker/deployment-log-writer';
import { DeploymentRuntimeService } from '@/features/deployments/worker/deployment-runtime.service';
import { DeploymentSourceService } from '@/features/deployments/worker/deployment-source.service';
import { EnvVarService } from '@/features/env-vars/env-var.service';
import { Injectable, Logger } from '@nestjs/common';
import { DeploymentStatus, EnvScope } from '@prisma/client';

@Injectable()
export class DeploymentExecutorService {
  private readonly logger = new Logger(DeploymentExecutorService.name);

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly source: DeploymentSourceService,
    private readonly runtime: DeploymentRuntimeService,
    private readonly publisher: DeploymentRealtimePublisherService,
    private readonly envVars: EnvVarService,
    private readonly dispatch: DeploymentDispatchService,
  ) {}

  async execute(deploymentId: string) {
    const context = await this.deployments.claimQueuedDeployment(deploymentId);

    if (!context) {
      this.logger.warn(
        `Skipping deployment ${deploymentId} because it is no longer claimable`,
      );
      return;
    }

    await this.publishStatusChanged({
      id: context.id,
      errorMessage: context.errorMessage,
      finishedAt: context.finishedAt,
      projectId: context.projectId,
      status: context.status,
      updatedAt: context.updatedAt,
    });

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
      
      // Resolve env vars một lần để dùng lại cho cả build và runtime.
      const resolvedEnvVars = await this.envVars.getResolvedEnabledProjectEnvVars(
        context.projectId,
      );
      // Tách env dành cho docker build.
      const buildEnvVars = resolvedEnvVars.filter((envVar) =>
        envVar.scope === EnvScope.BUILD || envVar.scope === EnvScope.BOTH,
      );
      // Tách env dành cho docker run.
      const runtimeEnvVars = resolvedEnvVars.filter((envVar) =>
        envVar.scope === EnvScope.RUNTIME || envVar.scope === EnvScope.BOTH,
      );

      if (buildEnvVars.length > 0) {
        await logWriter.system(
          `Applying ${buildEnvVars.length} build environment variables`,
        );
      }

      if (runtimeEnvVars.length > 0) {
        await logWriter.system(
          `Applying ${runtimeEnvVars.length} runtime environment variables`,
        );
      }

      const imageTag = this.runtime.buildImageTag(context);
      // update status deploying
      const buildingDeployment = await this.deployments.updateStatus(
        context.id,
        DeploymentStatus.BUILDING,
      );
      // pub vào redis để SSE lên FE
      await this.publishStatusChanged(buildingDeployment);

      await logWriter.system(`Building Docker image ${imageTag}`);
      await this.runtime.buildDockerImage(
        context,
        repoPath,
        imageTag,
        buildEnvVars,
        logWriter,
      );

      // update status deploying
      const deployingDeployment = await this.deployments.updateStatus(
        context.id,
        DeploymentStatus.DEPLOYING,
        {
          imageTag,
        },
      );
      // pub vào redis để SSE lên FE
      await this.publishStatusChanged(deployingDeployment);

      await logWriter.system(
        `Deploying container ${context.project.containerName}`,
      );

      const containerId = await this.runtime.deployContainer(
        context,
        imageTag,
        runtimeEnvVars,
        logWriter,
      );

      await logWriter.system(
        `Deployment finished successfully with container ${containerId}`,
      );
      await logWriter.flush();
      const successfulDeployment = await this.deployments.markSuccess(
        context.id,
        {
          imageTag,
          containerId,
        },
      );
      await this.publishStatusChanged(successfulDeployment);
    } catch (error) {
      const failure = toFailureInput(error);
      await logWriter.error(`Deployment failed: ${failure.errorMessage}`);
      await logWriter.flush();
      const failedDeployment = await this.deployments.markFailed(
        context.id,
        failure,
      );
      await this.publishStatusChanged(failedDeployment);
      throw error;
    } finally {
      try {
        await this.dispatch.promoteAndDispatchLatestPush(context.projectId);
      } catch (error) {
        this.logger.error(
          getErrorMessage(error),
          `Failed to dispatch pending GitHub push for project ${context.projectId}`,
        );
      }
    }
  }

  private async publishStatusChanged(deployment: {
    id: string;
    errorMessage: string | null;
    finishedAt: Date | null;
    projectId: string;
    status: DeploymentStatus;
    updatedAt: Date;
  }) {
    try {
      await this.publisher.publishStatusChanged(
        toDeploymentStatusChangedEvent(deployment),
      );
    } catch (error) {
      this.logger.error(
        getErrorMessage(error),
        `Failed to publish deployment status for ${deployment.id}`,
      );
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
