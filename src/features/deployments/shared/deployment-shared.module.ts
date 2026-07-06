import { DeploymentQueueService } from '@/features/deployments/shared/deployment-queue.service';
import { DeploymentRealtimePublisherService } from '@/features/deployments/shared/deployment-realtime-publisher.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import { DeploymentDispatchService } from '@/features/deployments/shared/deployment-dispatch.service';
import { DeploymentRealtimeService } from '@/features/deployments/api/deployment-realtime.service';
import { RedisModule } from '@/redis/redis.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [RedisModule],
  providers: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentRealtimePublisherService,
    DeploymentDispatchService,
    DeploymentRealtimeService,
  ],
  exports: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentRealtimePublisherService,
    DeploymentDispatchService,
    DeploymentRealtimeService,
  ],
})
export class DeploymentSharedModule {}
