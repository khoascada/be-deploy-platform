import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis/redis.module';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { GithubService } from './github.service';

@Module({
  imports: [RedisModule],
  controllers: [GithubController],
  providers: [GithubService, GithubRepository],
  exports: [GithubService],
})
export class GithubModule {}
