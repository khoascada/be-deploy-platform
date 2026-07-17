import { DeploymentStatus } from '@prisma/client';

export const DEPLOYMENT_STATUS_CHANGED_EVENT = 'deployment-status.changed';

export interface DeploymentStatusChangedEvent {
  type: typeof DEPLOYMENT_STATUS_CHANGED_EVENT;
  deploymentId: string;
  errorMessage: string | null;
  finishedAt: string | null;
  projectId: string;
  status: DeploymentStatus;
  updatedAt: string;
}

export function isDeploymentStatusChangedEvent(
  value: unknown,
): value is DeploymentStatusChangedEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.type === DEPLOYMENT_STATUS_CHANGED_EVENT &&
    typeof candidate.deploymentId === 'string' &&
    typeof candidate.projectId === 'string' &&
    isDeploymentStatus(candidate.status) &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.finishedAt === null || typeof candidate.finishedAt === 'string') &&
    (candidate.errorMessage === null || typeof candidate.errorMessage === 'string')
  );
}

export function toDeploymentStatusChangedEvent(deployment: {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  updatedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}): DeploymentStatusChangedEvent {
  return {
    type: DEPLOYMENT_STATUS_CHANGED_EVENT,
    deploymentId: deployment.id,
    errorMessage: deployment.errorMessage,
    finishedAt: deployment.finishedAt?.toISOString() ?? null,
    projectId: deployment.projectId,
    status: deployment.status,
    updatedAt: deployment.updatedAt.toISOString(),
  };
}

function isDeploymentStatus(value: unknown): value is DeploymentStatus {
  return (
    value === DeploymentStatus.QUEUED ||
    value === DeploymentStatus.PULLING ||
    value === DeploymentStatus.BUILDING ||
    value === DeploymentStatus.DEPLOYING ||
    value === DeploymentStatus.SUCCESS ||
    value === DeploymentStatus.FAILED ||
    value === DeploymentStatus.CANCELED
  );
}
