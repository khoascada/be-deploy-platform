import { LogLevel, LogStream } from '@prisma/client';

export const DEPLOYMENT_LOG_CREATED_EVENT = 'deployment-log.created';

export interface DeploymentLogCreatedEvent {
  type: typeof DEPLOYMENT_LOG_CREATED_EVENT;
  deploymentId: string;
  projectId: string;
  seq: number;
  stream: LogStream;
  level: LogLevel;
  message: string;
  createdAt: string;
}

export function isDeploymentLogCreatedEvent(
  value: unknown,
): value is DeploymentLogCreatedEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.type === DEPLOYMENT_LOG_CREATED_EVENT &&
    typeof candidate.deploymentId === 'string' &&
    typeof candidate.projectId === 'string' &&
    typeof candidate.seq === 'number' &&
    isLogStream(candidate.stream) &&
    isLogLevel(candidate.level) &&
    typeof candidate.message === 'string' &&
    typeof candidate.createdAt === 'string'
  );
}

function isLogStream(value: unknown): value is LogStream {
  return (
    value === LogStream.SYSTEM ||
    value === LogStream.STDOUT ||
    value === LogStream.STDERR
  );
}

function isLogLevel(value: unknown): value is LogLevel {
  return (
    value === LogLevel.DEBUG ||
    value === LogLevel.INFO ||
    value === LogLevel.WARN ||
    value === LogLevel.ERROR
  );
}
