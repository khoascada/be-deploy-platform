import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';
import {
  DEPLOYMENT_LOG_CREATED_EVENT,
  type DeploymentLogCreatedEvent,
} from '@/features/deployments/shared/deployment-log-events';

@Injectable()
export class DeploymentLogPublisherService {
  constructor(private readonly redis: RedisService) {}

  async publishLogCreated(event: DeploymentLogCreatedEvent) {
    await this.redis.client.publish(
      DEPLOYMENT_LOG_CREATED_EVENT,
      JSON.stringify(event),
    );
  }
}