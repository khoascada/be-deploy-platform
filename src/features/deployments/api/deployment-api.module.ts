import { Module } from '@nestjs/common';
import { ProjectModule } from '@/features/projects/project.module';
import { DeploymentController } from '@/features/deployments/api/deployment.controller';
import { DeploymentRealtimeService } from '@/features/deployments/api/deployment-realtime.service';
import { DeploymentService } from '@/features/deployments/api/deployment.service';
import { DeploymentSharedModule } from '@/features/deployments/shared/deployment-shared.module';

@Module({
  imports: [ProjectModule, DeploymentSharedModule],
  controllers: [DeploymentController],
  providers: [DeploymentService, DeploymentRealtimeService],
  exports: [DeploymentService, DeploymentRealtimeService],
})
export class DeploymentApiModule {}