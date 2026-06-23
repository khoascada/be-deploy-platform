import { ApiProperty } from '@nestjs/swagger';

export type DeployStatusDto =
  | 'QUEUED'
  | 'PULLING'
  | 'BUILDING'
  | 'DEPLOYING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELED';

export type DeployTriggerDto = 'manual' | 'webhook';

const DEPLOY_STATUS_VALUES: DeployStatusDto[] = [
  'QUEUED',
  'PULLING',
  'BUILDING',
  'DEPLOYING',
  'SUCCESS',
  'FAILED',
  'CANCELED',
];

export class LatestDeployDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' })
  id!: string;

  @ApiProperty({ enum: DEPLOY_STATUS_VALUES, example: 'SUCCESS' })
  status!: DeployStatusDto;

  @ApiProperty({
    example: 'f4d8e9c2d0a6b7c8e1f23456789abcdeffedcba9',
  })
  commitSha!: string;

  @ApiProperty({ example: 'Deploy production fix', nullable: true })
  commitMessage!: string | null;

  @ApiProperty({
    example: '2026-06-23T10:30:00.000Z',
    type: String,
  })
  createdAt!: string;

  @ApiProperty({
    example: '2026-06-23T10:34:00.000Z',
    type: String,
    nullable: true,
  })
  finishedAt!: string | null;

  @ApiProperty({ example: 'webhook', enum: ['manual', 'webhook'] })
  trigger!: DeployTriggerDto;
}

export class ProjectListItemDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' })
  id!: string;

  @ApiProperty({ example: 'My App' })
  name!: string;

  @ApiProperty({ example: 'octocat/my-app' })
  repoFullName!: string;

  @ApiProperty({ example: 'main' })
  deployBranch!: string;

  @ApiProperty({ example: 'https://github.com/octocat/my-app' })
  repoUrl!: string;

  @ApiProperty({ example: 5 })
  deployCount!: number;

  @ApiProperty({ example: '123456789', nullable: true })
  webhookId!: string | null;

  @ApiProperty({ example: false })
  isWebhookProvisioned!: boolean;

  @ApiProperty({ type: LatestDeployDto, nullable: true })
  latestDeploy!: LatestDeployDto | null;
}

export class ProjectListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class ProjectListResponseDto {
  @ApiProperty({ type: [ProjectListItemDto] })
  items!: ProjectListItemDto[];

  @ApiProperty({ type: ProjectListMetaDto })
  meta!: ProjectListMetaDto;
}

export function toLatestDeployDto(deployment: {
  id: string;
  status: DeployStatusDto;
  commitSha: string | null;
  commitMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  trigger: 'MANUAL' | 'GITHUB_PUSH';
}): LatestDeployDto {
  return {
    id: deployment.id,
    status: deployment.status,
    commitSha: deployment.commitSha ?? '',
    commitMessage: deployment.commitMessage,
    createdAt: deployment.createdAt.toISOString(),
    finishedAt: deployment.finishedAt ? deployment.finishedAt.toISOString() : null,
    trigger: deployment.trigger === 'MANUAL' ? 'manual' : 'webhook',
  };
}

export function toProjectListItemDto(project: {
  id: string;
  name: string;
  repoFullName: string;
  deployBranch: string;
  repoUrl: string;
  webhookId: string | null;
  _count: {
    deployments: number;
  };
  deployments: Array<{
    id: string;
    status: DeployStatusDto;
    commitSha: string | null;
    commitMessage: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    trigger: 'MANUAL' | 'GITHUB_PUSH';
  }>;
}): ProjectListItemDto {
  const latestDeploy = project.deployments[0];

  return {
    id: project.id,
    name: project.name,
    repoFullName: project.repoFullName,
    deployBranch: project.deployBranch,
    repoUrl: project.repoUrl,
    webhookId: project.webhookId,
    deployCount: project._count.deployments,
    isWebhookProvisioned: project.webhookId !== null,
    latestDeploy: latestDeploy ? toLatestDeployDto(latestDeploy) : null,
  };
}

export function toProjectListResponseDto(projects: {
  items: Array<{
    id: string;
    name: string;
    repoFullName: string;
    deployBranch: string;
    repoUrl: string;
    webhookId: string | null;
    _count: {
      deployments: number;
    };
    deployments: Array<{
      id: string;
      status: DeployStatusDto;
      commitSha: string | null;
      commitMessage: string | null;
      createdAt: Date;
      finishedAt: Date | null;
      trigger: 'MANUAL' | 'GITHUB_PUSH';
    }>;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}): ProjectListResponseDto {
  return {
    items: projects.items.map(toProjectListItemDto),
    meta: projects.meta,
  };
}
