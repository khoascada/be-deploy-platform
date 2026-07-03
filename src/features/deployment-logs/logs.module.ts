import { Module } from '@nestjs/common';
import { DeploymentApiModule } from '@/features/deployments/api/deployment-api.module';
import { DeploymentLogsController } from '@/features/logs/deployment-logs.controller';
import { DeploymentLogsService } from '@/features/logs/deployment-logs.service';
import { LogsRepository } from '@/features/logs/logs.repository';

@Module({
  imports: [DeploymentApiModule],
  controllers: [DeploymentLogsController],
  providers: [DeploymentLogsService, LogsRepository],
})
export class LogsModule {}
