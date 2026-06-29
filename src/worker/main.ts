import { DeploymentWorkerService } from '@/features/deployments/deployment-worker.service';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('DeploymentWorkerBootstrap');
  const worker = app.get(DeploymentWorkerService);

  await worker.start();

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down deployment worker`);
    await worker.stop();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap();
