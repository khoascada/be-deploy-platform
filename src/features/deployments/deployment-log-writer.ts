import { Logger } from '@nestjs/common';
import { LogLevel, LogStream } from '@prisma/client';
import { DeploymentRepository } from './deployment.repository';
import type { DeploymentExecutionContext } from './deployment.types';

export class DeploymentLogWriter {
  private readonly logger = new Logger(DeploymentLogWriter.name);
  private nextSeq = 1;
  private queue = Promise.resolve();

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly context: DeploymentExecutionContext,
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
        await this.deployments.appendLog({
          deploymentId: this.context.id,
          projectId: this.context.projectId,
          seq,
          level,
          stream,
          message: trimmedMessage,
        });
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
