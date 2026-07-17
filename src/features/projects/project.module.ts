import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { ProjectController } from './project.controller';
import { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';
import { DeploymentSharedModule } from '@/features/deployments/shared/deployment-shared.module';

@Module({
  imports: [GithubModule, DeploymentSharedModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
