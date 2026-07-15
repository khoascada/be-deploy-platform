import { ApiProperty } from '@nestjs/swagger';
import type { Prisma, Project, WebhookEventStatus } from '@prisma/client';
import {
  type DeployStatusDto,
  LatestDeployDto,
  toLatestDeployDto,
} from './project-list-response.dto';

const PROJECT_RUNNER_TYPE_VALUES = ['LOCAL', 'SSH'] as const;
const PROJECT_STATUS_VALUES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
const WEBHOOK_EVENT_STATUS_VALUES = [
  'RECEIVED',
  'PENDING',
  'PROCESSED',
  'IGNORED',
  'FAILED',
  'SUPERSEDED',
] as const;

export class LatestWebhookEventDto {
  @ApiProperty({ example: 'cm123webhookevent' })
  id!: string;

  @ApiProperty({ example: 'push' })
  eventName!: string;

  @ApiProperty({ example: 'PROCESSED', enum: WEBHOOK_EVENT_STATUS_VALUES })
  status!: WebhookEventStatus;

  @ApiProperty({
    example: 'Branch dev does not match deploy branch main',
    nullable: true,
  })
  statusReason!: string | null;

  @ApiProperty({ example: true })
  isVerified!: boolean;

  @ApiProperty({ example: '2026-07-11T10:00:00.000Z', type: String })
  receivedAt!: string;

  @ApiProperty({
    example: '2026-07-11T10:00:01.000Z',
    nullable: true,
    type: String,
  })
  processedAt!: string | null;

  @ApiProperty({ example: 'main', nullable: true })
  branch!: string | null;

  @ApiProperty({ example: 'abc123def456', nullable: true })
  commitSha!: string | null;

  @ApiProperty({ example: 'feat: add webhook activity', nullable: true })
  commitMessage!: string | null;
}

export class ProjectDetailDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' })
  id!: string;

  @ApiProperty({ example: 'user-123' })
  ownerId!: string;

  @ApiProperty({ example: 'My App' })
  name!: string;

  @ApiProperty({ example: 'my-app' })
  slug!: string;

  @ApiProperty({ example: 'octocat/my-app' })
  repoFullName!: string;

  @ApiProperty({ example: 'octocat' })
  repoOwner!: string;

  @ApiProperty({ example: 'my-app' })
  repoName!: string;

  @ApiProperty({ example: 'https://github.com/octocat/my-app' })
  repoUrl!: string;

  @ApiProperty({ example: '123456789', nullable: true })
  githubRepoId!: string | null;

  @ApiProperty({ example: 'main' })
  githubDefaultBranch!: string;

  @ApiProperty({ example: 'main' })
  deployBranch!: string;

  @ApiProperty({ example: 'apps/web' })
  rootDirectory!: string;

  @ApiProperty({ example: 'Dockerfile' })
  dockerfilePath!: string;

  @ApiProperty({ example: '.' })
  buildContext!: string;

  @ApiProperty({ example: 'LOCAL', enum: PROJECT_RUNNER_TYPE_VALUES })
  runnerType!: Project['runnerType'];


  @ApiProperty({ example: '10.0.0.1', nullable: true })
  sshHost!: string | null;

  @ApiProperty({ example: 22, nullable: true })
  sshPort!: number | null;

  @ApiProperty({ example: 'deploy', nullable: true })
  sshUser!: string | null;

  @ApiProperty({ example: 'encrypted-ssh-key', nullable: true })
  sshKeyEncrypted!: string | null;

  @ApiProperty({ example: 3000 })
  containerPort!: number;

  @ApiProperty({ example: 8080, nullable: true })
  hostPort!: number | null;

  @ApiProperty({ example: 'my-app-container', nullable: true })
  containerName!: string | null;

  @ApiProperty({ example: 'mini-deploy/my-app', nullable: true })
  imageName!: string | null;

  @ApiProperty({ example: true })
  autoDeploy!: boolean;

  @ApiProperty({ example: '123456789', nullable: true })
  webhookId!: string | null;

  @ApiProperty({ type: LatestDeployDto, nullable: true })
  latestDeploy!: LatestDeployDto | null;

  @ApiProperty({ type: LatestWebhookEventDto, nullable: true })
  latestWebhookEvent!: LatestWebhookEventDto | null;

  @ApiProperty({ example: 'ACTIVE', enum: PROJECT_STATUS_VALUES })
  status!: Project['status'];

  @ApiProperty({ example: '2026-06-23T10:00:00.000Z', type: String })
  createdAt!: Date;

  @ApiProperty({ example: '2026-06-23T10:30:00.000Z', type: String })
  updatedAt!: Date;
}

type ProjectDetailWithDeployments = Project & {
  deployments: Array<{
    id: string;
    status: DeployStatusDto;
    commitSha: string | null;
    commitMessage: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    trigger: 'MANUAL' | 'GITHUB_PUSH';
  }>;
  webhookEvents?: Array<{
    id: string;
    eventName: string;
    status: WebhookEventStatus;
    statusReason: string | null;
    isVerified: boolean;
    payload: Prisma.JsonValue;
    receivedAt: Date;
    processedAt: Date | null;
  }>;
};

export function toProjectDetailDto(
  project: ProjectDetailWithDeployments,
): ProjectDetailDto {
  const latestDeploy = project.deployments[0];
  const latestWebhookEvent = project.webhookEvents?.[0];

  return {
    id: project.id,
    ownerId: project.ownerId,
    name: project.name,
    slug: project.slug,
    repoFullName: project.repoFullName,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    repoUrl: project.repoUrl,
    githubRepoId: project.githubRepoId,
    githubDefaultBranch: project.githubDefaultBranch,
    deployBranch: project.deployBranch,
    rootDirectory: project.rootDirectory,
    dockerfilePath: project.dockerfilePath,
    buildContext: project.buildContext,
    runnerType: project.runnerType,
    sshHost: project.sshHost,
    sshPort: project.sshPort,
    sshUser: project.sshUser,
    sshKeyEncrypted: project.sshKeyEncrypted,
    containerPort: project.containerPort,
    hostPort: project.hostPort,
    containerName: project.containerName,
    imageName: project.imageName,
    autoDeploy: project.autoDeploy,
    webhookId: project.webhookId,
    latestDeploy: latestDeploy ? toLatestDeployDto(latestDeploy) : null,
    latestWebhookEvent: latestWebhookEvent
      ? toLatestWebhookEventDto(latestWebhookEvent)
      : null,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function toLatestWebhookEventDto(event: {
  id: string;
  eventName: string;
  status: WebhookEventStatus;
  statusReason: string | null;
  isVerified: boolean;
  payload: Prisma.JsonValue;
  receivedAt: Date;
  processedAt: Date | null;
}): LatestWebhookEventDto {
  const push = event.eventName === 'push' ? parsePushMetadata(event.payload) : null;

  return {
    id: event.id,
    eventName: event.eventName,
    status: event.status,
    statusReason: event.statusReason,
    isVerified: event.isVerified,
    receivedAt: event.receivedAt.toISOString(),
    processedAt: event.processedAt?.toISOString() ?? null,
    branch: push?.branch ?? null,
    commitSha: push?.commitSha ?? null,
    commitMessage: push?.commitMessage ?? null,
  };
}

function parsePushMetadata(payload: Prisma.JsonValue) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const value = payload as Record<string, Prisma.JsonValue>;
  const ref = value.ref;
  if (typeof ref !== 'string' || !ref.startsWith('refs/heads/')) return null;

  const headCommit =
    value.head_commit &&
    typeof value.head_commit === 'object' &&
    !Array.isArray(value.head_commit)
      ? (value.head_commit as Record<string, Prisma.JsonValue>)
      : null;

  return {
    branch: ref.slice('refs/heads/'.length),
    commitSha: typeof headCommit?.id === 'string' ? headCommit.id : null,
    commitMessage:
      typeof headCommit?.message === 'string' ? headCommit.message : null,
  };
}
