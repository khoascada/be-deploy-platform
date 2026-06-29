import { Module } from '@nestjs/common';
import { ProjectModule } from '../projects/project.module';
import { DeploymentController } from './deployment.controller';
import { DeploymentRepository } from './deployment.repository';
import { DeploymentService } from './deployment.service';

@Module({
  imports: [ProjectModule],
  controllers: [DeploymentController],
  providers: [DeploymentService, DeploymentRepository],
  exports: [DeploymentService],
})
export class DeploymentModule {}
