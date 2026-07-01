import { RedisModule } from '@/redis/redis.module';
import { Module } from '@nestjs/common';
import { DeploymentLogPublisherService } from '@/features/deployments/shared/deployment-log-publisher.service';
import { DeploymentQueueService } from '@/features/deployments/shared/deployment-queue.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';

@Module({
  imports: [RedisModule],
  providers: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentLogPublisherService,
  ],
  exports: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentLogPublisherService,
  ],
})
export class DeploymentSharedModule {}