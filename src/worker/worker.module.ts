import { ConfigModule } from '@/config/config.module';
import { DeploymentModule } from '@/features/deployments/deployment.module';
import { GithubModule } from '@/features/github/github.module';
import { ProjectModule } from '@/features/projects/project.module';
import { LoggerModule } from '@/logger/logger.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    GithubModule,
    ProjectModule,
    DeploymentModule,
  ],
})
export class WorkerAppModule {}
