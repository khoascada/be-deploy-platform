import type { EnvVars } from '@/config/env.validation';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  DEPLOYMENT_QUEUE_JOB_NAME,
  DEPLOYMENT_QUEUE_NAME,
} from './deployment.constants';
import type { DeploymentJobData } from './deployment.types';

@Injectable()
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
      prefix: config.get('DEPLOYMENT_QUEUE_PREFIX', { infer: true }),
      defaultJobOptions: {
        removeOnComplete: 100,
      },
    });
  }

  async enqueue(deploymentId: string) {
    const job = await this.queue.add(
      DEPLOYMENT_QUEUE_JOB_NAME,
      { deploymentId },
      { jobId: deploymentId },
    );
    this.logger.log(`Enqueued deployment job ${job.id}`);
    return job;
  }

  async onModuleDestroy() {
    await this.queue.close();
    await this.connection.quit();
  }
}

export function createBullMqConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
}
