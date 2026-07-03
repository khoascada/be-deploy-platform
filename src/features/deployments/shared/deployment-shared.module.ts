import { DeploymentQueueService } from '@/features/deployments/shared/deployment-queue.service';
import { DeploymentRealtimePublisherService } from '@/features/deployments/shared/deployment-realtime-publisher.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import { RedisModule } from '@/redis/redis.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [RedisModule],
  providers: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentRealtimePublisherService,
  ],
  exports: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentRealtimePublisherService,
  ],
})
export class DeploymentSharedModule {}
