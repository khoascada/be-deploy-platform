import {
  DEPLOYMENT_LOG_CREATED_EVENT,
  type DeploymentLogCreatedEvent,
  isDeploymentLogCreatedEvent,
} from '@/features/deployments/shared/types/deployment-log-events';
import { RedisService } from '@/redis/redis.service';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import type Redis from 'ioredis';

type DeploymentLogListener = (event: DeploymentLogCreatedEvent) => void;

// redis subscribe
@Injectable()
export class DeploymentRealtimeService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DeploymentRealtimeService.name);
  private readonly listeners = new Map<string, Set<DeploymentLogListener>>();
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit() {
    if (!this.httpAdapterHost.httpAdapter) {
      return;
    }

    // connection để lắng nghe pub/sub
    this.subscriber = this.redis.client.duplicate();
    this.subscriber.on('error', (error) => {
      this.logger.error(error, 'Deployment log subscriber error');
    });
    this.subscriber.on('message', (channel, message) => {
      if (channel !== DEPLOYMENT_LOG_CREATED_EVENT) {
        return;
      }

      const event = parseDeploymentLogCreatedEvent(message);
      if (!event) {
        this.logger.warn('Ignoring malformed deployment log event payload');
        return;
      }

      this.emit(event);
    });

    await this.subscriber.connect();
    await this.subscriber.subscribe(DEPLOYMENT_LOG_CREATED_EVENT);
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    this.listeners.clear();
  }

  subscribe(deploymentId: string, listener: DeploymentLogListener): () => void {
    const listeners = this.listeners.get(deploymentId) ?? new Set();
    listeners.add(listener);
    this.listeners.set(deploymentId, listeners);

    return () => {
      const currentListeners = this.listeners.get(deploymentId);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        this.listeners.delete(deploymentId);
      }
    };
  }

  writeSseEvent(response: Response, event: DeploymentLogCreatedEvent) {
    response.write(
      `event: ${DEPLOYMENT_LOG_CREATED_EVENT}\ndata: ${JSON.stringify(event)}\n\n`,
    );
  }

  // nhận event -> gọi từng listener
  private emit(event: DeploymentLogCreatedEvent) {
    const listeners = this.listeners.get(event.deploymentId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    // gọi listener  với para event
    for (const listener of listeners) {
      listener(event);
    }
  }
}

// biến message từ redis từ string -> DeploymentLogCreatedEvent
function parseDeploymentLogCreatedEvent(
  payload: string,
): DeploymentLogCreatedEvent | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return isDeploymentLogCreatedEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
