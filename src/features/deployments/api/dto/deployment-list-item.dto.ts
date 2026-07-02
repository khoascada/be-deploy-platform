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

export class DeploymentListItemDto {
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

  @ApiProperty({ example: 'abc123def456' })
  commitSha!: string | null;

  @ApiProperty({ example: 'Fix build cache issue', nullable: true })
  commitMessage!: string | null;

  @ApiProperty({ example: '2026-06-29T10:00:00.000Z', type: String })
  queuedAt!: string;

  @ApiProperty({ example: '2026-06-29T10:00:00.000Z', type: String })
  createdAt!: string;

  @ApiProperty({
    example: '2026-06-29T10:10:00.000Z',
    type: String,
    nullable: true,
  })
  finishedAt!: string | null;
}

type DeploymentListRecord = Pick<
  Deployment,
  | 'id'
  | 'projectId'
  | 'deploymentNumber'
  | 'trigger'
  | 'status'
  | 'branch'
  | 'commitSha'
  | 'commitMessage'
  | 'queuedAt'
  | 'createdAt'
  | 'finishedAt'
>;

export function toDeploymentListItemDto(
  deployment: DeploymentListRecord,
): DeploymentListItemDto {
  return {
    id: deployment.id,
    projectId: deployment.projectId,
    deploymentNumber: deployment.deploymentNumber,
    trigger: deployment.trigger,
    status: deployment.status,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    commitMessage: deployment.commitMessage,
    queuedAt: deployment.queuedAt.toISOString(),
    createdAt: deployment.createdAt.toISOString(),
    finishedAt: deployment.finishedAt?.toISOString() ?? null,
  };
}
