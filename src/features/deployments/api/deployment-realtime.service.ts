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
import {
  DEPLOYMENT_CREATED_EVENT,
  type DeploymentCreatedEvent,
  isDeploymentCreatedEvent,
} from '@/features/deployments/shared/types/deployment-created-events';

type DeploymentRealtimeEvent =
  | DeploymentLogCreatedEvent
  | DeploymentStatusChangedEvent;
type DeploymentRealtimeListener = (event: DeploymentRealtimeEvent) => void;
type ProjectRealtimeListener = (event: DeploymentCreatedEvent) => void;

@Injectable()
export class DeploymentRealtimeService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DeploymentRealtimeService.name);
  private readonly listeners = new Map<string, Set<DeploymentRealtimeListener>>();
  private readonly projectListeners = new Map<string, Set<ProjectRealtimeListener>>();
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

      if (event.type === DEPLOYMENT_CREATED_EVENT) {
        this.emitProject(event);
      } else {
        this.emit(event);
      }
    });

    await this.subscriber.connect();
    await this.subscriber.subscribe(
      DEPLOYMENT_LOG_CREATED_EVENT,
      DEPLOYMENT_STATUS_CHANGED_EVENT,
      DEPLOYMENT_CREATED_EVENT,
    );
  }

  async onModuleDestroy() {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }

    this.listeners.clear();
    this.projectListeners.clear();
  }

  subscribeProject(projectId: string, listener: ProjectRealtimeListener) {
    const listeners = this.projectListeners.get(projectId) ?? new Set();
    listeners.add(listener);
    this.projectListeners.set(projectId, listeners);
    return () => {
      const current = this.projectListeners.get(projectId);
      current?.delete(listener);
      if (current?.size === 0) this.projectListeners.delete(projectId);
    };
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

  writeSseEvent(
    response: Response,
    event: DeploymentRealtimeEvent | DeploymentCreatedEvent,
  ) {
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

  private emitProject(event: DeploymentCreatedEvent) {
    for (const listener of this.projectListeners.get(event.projectId) ?? []) {
      listener(event);
    }
  }
}

function parseDeploymentRealtimeEvent(
  channel: string,
  payload: string,
): DeploymentRealtimeEvent | DeploymentCreatedEvent | null {
  try {
    const parsed: unknown = JSON.parse(payload);

    if (
      channel === DEPLOYMENT_CREATED_EVENT &&
      isDeploymentCreatedEvent(parsed)
    ) {
      return parsed;
    }

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
