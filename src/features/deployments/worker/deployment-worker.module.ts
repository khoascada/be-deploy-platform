import { DeploymentSharedModule } from '@/features/deployments/shared/deployment-shared.module';
import { DeploymentCommandRunnerService } from '@/features/deployments/worker/deployment-command-runner.service';
import { DeploymentExecutorService } from '@/features/deployments/worker/deployment-executor.service';
import { DeploymentRuntimeService } from '@/features/deployments/worker/deployment-runtime.service';
import { DeploymentSourceService } from '@/features/deployments/worker/deployment-source.service';
import { DeploymentWorkerService } from '@/features/deployments/worker/deployment-worker.service';
import { GithubModule } from '@/features/github/github.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [GithubModule, DeploymentSharedModule],
  providers: [
    DeploymentCommandRunnerService,
    DeploymentSourceService,
    DeploymentRuntimeService,
    DeploymentExecutorService,
    DeploymentWorkerService,
  ],
  exports: [DeploymentWorkerService],
})
export class DeploymentWorkerModule {}
