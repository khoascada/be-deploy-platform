import type { EnvVars } from '@/config/env.validation';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  DEPLOYMENT_QUEUE_JOB_NAME,
  DEPLOYMENT_QUEUE_NAME,
} from '@/features/deployments/shared/deployment.constants';
import type { DeploymentJobData } from '@/features/deployments/shared/deployment.types';

@Injectable()
// onModuleDestroy giúp Nest gọi method khi bạn shutdown app/module (onModuleDestroy)
export class DeploymentQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DeploymentQueueService.name);
  private readonly connection: IORedis;
  private readonly queue: Queue<DeploymentJobData>;

  constructor(private readonly config: ConfigService<EnvVars, true>) {
    this.connection = createBullMqConnection(
      config.get('REDIS_URL', { infer: true }),
    );
    this.queue = new Queue<DeploymentJobData>(DEPLOYMENT_QUEUE_NAME, {
      connection: this.connection,
      prefix: this.config.get('DEPLOYMENT_QUEUE_PREFIX', { infer: true }),
      // bullMQ chỉ giữ 100 completed jobs gần nhất
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }

  // add job vào queue.
  async enqueue(deploymentId: string) {
    const job = await this.queue.add(
      DEPLOYMENT_QUEUE_JOB_NAME,
      { deploymentId },
      // jobId trong redis = depId trong DB
      { jobId: deploymentId },
    );
    this.logger.log(`Enqueued deployment job ${job.id}`);
    return job;
  }

  // dọn tài nguyên đang mở
  // đóng bullMQ
  // đóng Connection redis
  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}

// tạo redis connection riêng cho bullMQ
export function createBullMqConnection(redisUrl: string) {
  // tạo 1 client redis từ ioredis
  return new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}
