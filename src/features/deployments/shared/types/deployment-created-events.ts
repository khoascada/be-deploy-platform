import type { Deployment, DeploymentTrigger } from '@prisma/client';

export const DEPLOYMENT_CREATED_EVENT = 'deployment.created';

export interface DeploymentCreatedEvent {
  type: typeof DEPLOYMENT_CREATED_EVENT;
  projectId: string;
  deploymentId: string;
  deploymentNumber: number;
  trigger: DeploymentTrigger;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  createdAt: string;
}

export function toDeploymentCreatedEvent(
  deployment: Pick<
    Deployment,
    | 'id'
    | 'projectId'
    | 'deploymentNumber'
    | 'trigger'
    | 'branch'
    | 'commitSha'
    | 'commitMessage'
    | 'createdAt'
  >,
): DeploymentCreatedEvent {
  return {
    type: DEPLOYMENT_CREATED_EVENT,
    projectId: deployment.projectId,
    deploymentId: deployment.id,
    deploymentNumber: deployment.deploymentNumber,
    trigger: deployment.trigger,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    commitMessage: deployment.commitMessage,
    createdAt: deployment.createdAt.toISOString(),
  };
}

export function isDeploymentCreatedEvent(
  value: unknown,
): value is DeploymentCreatedEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    event.type === DEPLOYMENT_CREATED_EVENT &&
    typeof event.projectId === 'string' &&
    typeof event.deploymentId === 'string' &&
    typeof event.deploymentNumber === 'number' &&
    (event.trigger === 'MANUAL' || event.trigger === 'GITHUB_PUSH') &&
    typeof event.branch === 'string' &&
    (event.commitSha === null || typeof event.commitSha === 'string') &&
    (event.commitMessage === null || typeof event.commitMessage === 'string') &&
    typeof event.createdAt === 'string'
  );
}
