import { DeploymentWorkerService } from '@/features/deployments/deployment-worker.service';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker.module';

async function bootstrap() {
  // ko dùng create mà dùng createApp... là ko mở HTTP Server, chỉ tạo DI Container
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  const logger = new Logger('DeploymentWorkerBootstrap');
  // lấy worker service từ Nest DI
  const worker = app.get(DeploymentWorkerService);

  await worker.start();

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down deployment worker`);
    await worker.stop();
    await app.close();
    process.exit(0);
  };

  // lắng nghe khi b bấm Ctrl + C -> shutdown
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  // Lắng nghe khi shutdown từ Docker, pm2, ...
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void bootstrap();
