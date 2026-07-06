import { Injectable, Logger } from '@nestjs/common';
import type { Deployment } from '@prisma/client';
import { DeploymentQueueService } from './deployment-queue.service';
import { DeploymentRealtimePublisherService } from './deployment-realtime-publisher.service';
import { DeploymentRepository } from './deployment.repository';
import { toDeploymentCreatedEvent } from './types/deployment-created-events';
import { toDeploymentStatusChangedEvent } from './types/deployment-status-events';

@Injectable()
export class DeploymentDispatchService {
  private readonly logger = new Logger(DeploymentDispatchService.name);

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly queue: DeploymentQueueService,
    private readonly publisher: DeploymentRealtimePublisherService,
  ) {}

  async dispatch(deployment: Deployment) {
    await this.safePublishCreated(deployment);
    try {
      await this.queue.enqueue(deployment.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enqueue deployment';
      const failed = await this.deployments.markEnqueueFailed(deployment.id, message);
      await this.publisher.publishStatusChanged(toDeploymentStatusChangedEvent(failed));
      throw error;
    }
  }

  async promoteAndDispatchLatestPush(projectId: string) {
    const deployment = await this.deployments.promoteLatestPendingGithubPush(projectId);
    if (deployment) await this.dispatch(deployment);
    return deployment;
  }

  private async safePublishCreated(deployment: Deployment) {
    try {
      await this.publisher.publishCreated(toDeploymentCreatedEvent(deployment));
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'Failed to publish deployment.created',
      );
    }
  }
}
