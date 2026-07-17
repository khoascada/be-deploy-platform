import { DeploymentRealtimeService } from '@/features/deployments/api/deployment-realtime.service';
import { DeploymentDispatchService } from '@/features/deployments/shared/deployment-dispatch.service';
import { DeploymentQueueService } from '@/features/deployments/shared/deployment-queue.service';
import { DeploymentRealtimePublisherService } from '@/features/deployments/shared/deployment-realtime-publisher.service';
import { ProjectRuntimeCleanupService } from '@/features/deployments/shared/deployment-runtime-cleanup.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import { DeploymentCommandRunnerService } from '@/features/deployments/worker/deployment-command-runner.service';
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
    DeploymentCommandRunnerService,
    ProjectRuntimeCleanupService,
  ],
  exports: [
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentRealtimePublisherService,
    DeploymentDispatchService,
    DeploymentRealtimeService,
    DeploymentCommandRunnerService,
    ProjectRuntimeCleanupService,
  ],
})
export class DeploymentSharedModule {}
