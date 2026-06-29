import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { ProjectModule } from '../projects/project.module';
import { DeploymentCommandRunnerService } from './deployment-command-runner.service';
import { DeploymentController } from './deployment.controller';
import { DeploymentExecutorService } from './deployment-executor.service';
import { DeploymentQueueService } from './deployment-queue.service';
import { DeploymentRepository } from './deployment.repository';
import { DeploymentService } from './deployment.service';
import { DeploymentWorkerService } from './deployment-worker.service';

@Module({
  imports: [ProjectModule, GithubModule],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    DeploymentRepository,
    DeploymentQueueService,
    DeploymentCommandRunnerService,
    DeploymentExecutorService,
    DeploymentWorkerService,
  ],
  exports: [DeploymentService, DeploymentWorkerService],
})
export class DeploymentModule {}
