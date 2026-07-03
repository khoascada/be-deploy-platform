import {
  DEPLOYMENT_LOG_CREATED_EVENT,
  type DeploymentLogCreatedEvent,
} from '@/features/deployments/shared/types/deployment-log-events';
import {
  DEPLOYMENT_STATUS_CHANGED_EVENT,
  type DeploymentStatusChangedEvent,
} from '@/features/deployments/shared/types/deployment-status-events';
import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeploymentRealtimePublisherService {
  constructor(private readonly redis: RedisService) {}

  async publishLogCreated(event: DeploymentLogCreatedEvent) {
    await this.redis.client.publish(
      DEPLOYMENT_LOG_CREATED_EVENT,
      JSON.stringify(event),
    );
  }

  async publishStatusChanged(event: DeploymentStatusChangedEvent) {
    await this.redis.client.publish(
      DEPLOYMENT_STATUS_CHANGED_EVENT,
      JSON.stringify(event),
    );
  }
}
