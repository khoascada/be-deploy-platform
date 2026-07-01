import {
  DEPLOYMENT_LOG_CREATED_EVENT,
  type DeploymentLogCreatedEvent,
} from '@/features/deployments/shared/deployment-log-events';
import { DeploymentLogPublisherService } from '@/features/deployments/shared/deployment-log-publisher.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import type { DeploymentExecutionContext } from '@/features/deployments/shared/deployment.types';
import { Logger } from '@nestjs/common';
import { LogLevel, LogStream } from '@prisma/client';

export class DeploymentLogWriter {
  private readonly logger = new Logger(DeploymentLogWriter.name);
  private nextSeq = 1;
  private queue = Promise.resolve();

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly context: DeploymentExecutionContext,
    private readonly publisher: DeploymentLogPublisherService,
  ) {}

  system(message: string) {
    return this.append(LogStream.SYSTEM, LogLevel.INFO, message);
  }

  stdout(message: string) {
    return this.append(LogStream.STDOUT, LogLevel.INFO, message);
  }

  stderr(message: string) {
    return this.append(LogStream.STDERR, LogLevel.INFO, message);
  }

  error(message: string) {
    return this.append(LogStream.SYSTEM, LogLevel.ERROR, message);
  }

  async flush() {
    await this.queue;
  }

  private append(stream: LogStream, level: LogLevel, message: string) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return Promise.resolve();
    }

    this.writeToTerminal(stream, level, trimmedMessage);

    const seq = this.nextSeq;
    this.nextSeq += 1;

    this.queue = this.queue
      .then(async () => {
        const createdLog = await this.deployments.appendLog({
          deploymentId: this.context.id,
          projectId: this.context.projectId,
          seq,
          level,
          stream,
          message: trimmedMessage,
        });

        try {
          const event: DeploymentLogCreatedEvent = {
            type: DEPLOYMENT_LOG_CREATED_EVENT,
            deploymentId: createdLog.deploymentId,
            projectId: createdLog.projectId,
            seq: createdLog.seq,
            stream: createdLog.stream,
            level: createdLog.level,
            message: createdLog.message,
            createdAt: createdLog.createdAt.toISOString(),
          };

          await this.publisher.publishLogCreated(event);
        } catch (error: unknown) {
          this.logger.error(
            getErrorMessage(error),
            'Failed to publish deployment log event',
          );
        }
      })
      .catch((error: unknown) => {
        this.logger.error(getErrorMessage(error));
      });

    return this.queue;
  }

  private writeToTerminal(stream: LogStream, level: LogLevel, message: string) {
    const prefix = `[deploy #${this.context.deploymentNumber} ${this.context.project.slug}] [${stream}]`;
    const formattedMessage = `${prefix} ${message}`;

    if (level === LogLevel.ERROR) {
      this.logger.error(formattedMessage);
      return;
    }

    this.logger.log(formattedMessage);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown deployment error';
}