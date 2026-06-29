import { DeploymentStatus } from '@prisma/client';

export const DEPLOYMENT_QUEUE_NAME = 'deployment-jobs';
export const DEPLOYMENT_QUEUE_JOB_NAME = 'execute-deployment';

export const ACTIVE_DEPLOYMENT_STATUSES = [
  DeploymentStatus.QUEUED,
  DeploymentStatus.PULLING,
  DeploymentStatus.BUILDING,
  DeploymentStatus.DEPLOYING,
] as const;
