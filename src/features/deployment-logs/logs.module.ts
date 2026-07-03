import { DeploymentLogsController } from '@/features/deployment-logs/deployment-logs.controller';
import { DeploymentLogsService } from '@/features/deployment-logs/deployment-logs.service';
import { LogsRepository } from '@/features/deployment-logs/logs.repository';
import { DeploymentApiModule } from '@/features/deployments/api/deployment-api.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [DeploymentApiModule],
  controllers: [DeploymentLogsController],
  providers: [DeploymentLogsService, LogsRepository],
})
export class LogsModule {}
