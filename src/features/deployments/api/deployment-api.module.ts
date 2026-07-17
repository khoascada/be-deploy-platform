import { Module } from '@nestjs/common';
import { DeploymentAccessService } from '@/features/deployments/api/deployment-access.service';
import { DeploymentController } from '@/features/deployments/api/deployment.controller';
import { DeploymentService } from '@/features/deployments/api/deployment.service';
import { DeploymentSharedModule } from '@/features/deployments/shared/deployment-shared.module';
import { ProjectModule } from '@/features/projects/project.module';

@Module({
  imports: [ProjectModule, DeploymentSharedModule],
  controllers: [DeploymentController],
  providers: [
    DeploymentService,
    DeploymentAccessService,
  ],
  exports: [DeploymentAccessService],
})
export class DeploymentApiModule {}
