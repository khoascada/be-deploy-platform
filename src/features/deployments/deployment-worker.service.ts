import type { EnvVars } from '@/config/env.validation';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { DEPLOYMENT_QUEUE_NAME } from './deployment.constants';
import { createBullMqConnection } from './deployment-queue.service';
import { DeploymentExecutorService } from './deployment-executor.service';
import type { DeploymentJobData } from './deployment.types';

@Injectable()
export class DeploymentWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(DeploymentWorkerService.name);
  private connection: IORedis | null = null;
  private worker: Worker<DeploymentJobData> | null = null;

  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly executor: DeploymentExecutorService,
  ) {}

  async start() {
    if (this.worker) {
      return;
    }

    this.connection = createBullMqConnection(
      this.config.get('REDIS_URL', { infer: true }),
    );
    this.worker = new Worker<DeploymentJobData>(
      DEPLOYMENT_QUEUE_NAME,
      async (job) => {
        await this.executor.execute(job.data.deploymentId);
      },
      {
        connection: this.connection,
        concurrency: this.config.get('DEPLOYMENT_QUEUE_CONCURRENCY', {
          infer: true,
        }),
        prefix: this.config.get('DEPLOYMENT_QUEUE_PREFIX', { infer: true }),
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Completed deployment job ${job.id}`);
    });
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Deployment job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      );
    });

    await this.worker.waitUntilReady();
    this.logger.log('Deployment worker started');
  }

  async stop() {
    await this.worker?.close();
    this.worker = null;

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
  }

  async onModuleDestroy() {
    await this.stop();
  }
}
