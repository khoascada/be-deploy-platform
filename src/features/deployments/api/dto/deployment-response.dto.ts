import { ApiProperty } from '@nestjs/swagger';
import type { Deployment } from '@prisma/client';

const DEPLOYMENT_TRIGGER_VALUES = ['MANUAL', 'GITHUB_PUSH'] as const;
const DEPLOYMENT_STATUS_VALUES = [
  'QUEUED',
  'PULLING',
  'BUILDING',
  'DEPLOYING',
  'SUCCESS',
  'FAILED',
  'CANCELED',
] as const;

export class DeploymentResponseDto {
  @ApiProperty({ example: 'deployment-123' })
  id!: string;

  @ApiProperty({ example: 'project-123' })
  projectId!: string;

  @ApiProperty({ example: 1 })
  deploymentNumber!: number;

  @ApiProperty({ example: 'MANUAL', enum: DEPLOYMENT_TRIGGER_VALUES })
  trigger!: Deployment['trigger'];

  @ApiProperty({ example: 'QUEUED', enum: DEPLOYMENT_STATUS_VALUES })
  status!: Deployment['status'];

  @ApiProperty({ example: 'main' })
  branch!: string;

  @ApiProperty({ example: '2026-06-29T10:00:00.000Z', type: String })
  queuedAt!: string;

  @ApiProperty({ example: '2026-06-29T10:00:00.000Z', type: String })
  createdAt!: string;
}

export function toDeploymentResponseDto(
  deployment: Pick<
    Deployment,
    | 'id'
    | 'projectId'
    | 'deploymentNumber'
    | 'trigger'
    | 'status'
    | 'branch'
    | 'queuedAt'
    | 'createdAt'
  >,
): DeploymentResponseDto {
  return {
    id: deployment.id,
    projectId: deployment.projectId,
    deploymentNumber: deployment.deploymentNumber,
    trigger: deployment.trigger,
    status: deployment.status,
    branch: deployment.branch,
    queuedAt: deployment.queuedAt.toISOString(),
    createdAt: deployment.createdAt.toISOString(),
  };
}
