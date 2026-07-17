import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { GithubService } from './github.service';
import { DeploymentSharedModule } from '@/features/deployments/shared/deployment-shared.module';

@Module({
  imports: [RedisModule, DeploymentSharedModule],
  controllers: [GithubController],
  providers: [GithubService, GithubRepository],
  exports: [GithubService],
})
export class GithubModule {}
