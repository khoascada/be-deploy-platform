import { ConfigModule } from '@/config/config.module';
import { DeploymentWorkerModule } from '@/features/deployments/worker/deployment-worker.module';
import { LoggerModule } from '@/logger/logger.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, DeploymentWorkerModule],
})
export class WorkerAppModule {}