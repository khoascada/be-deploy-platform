import {
  DEPLOYMENT_LOG_CREATED_EVENT,
  type DeploymentLogCreatedEvent,
  isDeploymentLogCreatedEvent,
} from '@/features/deployments/shared/types/deployment-log-events';
import {
  DEPLOYMENT_STATUS_CHANGED_EVENT,
  type DeploymentStatusChangedEvent,
  isDeploymentStatusChangedEvent,
} from '@/features/deployments/shared/types/deployment-status-events';
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

type DeploymentRealtimeEvent =
  | DeploymentLogCreatedEvent
  | DeploymentStatusChangedEvent;
type DeploymentRealtimeListener = (event: DeploymentRealtimeEvent) => void;

@Injectable()
export class DeploymentRealtimeService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DeploymentRealtimeService.name);
  private readonly listeners = new Map<string, Set<DeploymentRealtimeListener>>();
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  async onModuleInit() {
    if (!this.httpAdapterHost.httpAdapter) {
      return;
    }

    this.subscriber = this.redis.client.duplicate();
    this.subscriber.on('error', (error) => {
      this.logger.error(error, 'Deployment realtime subscriber error');
    });
    this.subscriber.on('message', (channel, message) => {
      const event = parseDeploymentRealtimeEvent(channel, message);
      if (!event) {
        this.logger.warn(
          `Ignoring malformed deployment realtime payload for channel ${channel}`,
        );
        return;
      }

      this.emit(event);
    });

    await this.subscriber.connect();
    await this.subscriber.subscribe(
      DEPLOYMENT_LOG_CREATED_EVENT,
      DEPLOYMENT_STATUS_CHANGED_EVENT,
    );
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    this.listeners.clear();
  }

  subscribe(
    deploymentId: string,
    listener: DeploymentRealtimeListener,
  ): () => void {
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

  writeSseEvent(response: Response, event: DeploymentRealtimeEvent) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  private emit(event: DeploymentRealtimeEvent) {
    const listeners = this.listeners.get(event.deploymentId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }
}

function parseDeploymentRealtimeEvent(
  channel: string,
  payload: string,
): DeploymentRealtimeEvent | null {
  try {
    const parsed: unknown = JSON.parse(payload);

    if (
      channel === DEPLOYMENT_LOG_CREATED_EVENT &&
      isDeploymentLogCreatedEvent(parsed)
    ) {
      return parsed;
    }

    if (
      channel === DEPLOYMENT_STATUS_CHANGED_EVENT &&
      isDeploymentStatusChangedEvent(parsed)
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
