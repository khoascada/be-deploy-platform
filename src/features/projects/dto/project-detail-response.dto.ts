import { ApiProperty } from '@nestjs/swagger';
import type { Project } from '@prisma/client';
import {
  type DeployStatusDto,
  LatestDeployDto,
  toLatestDeployDto,
} from './project-list-response.dto';

const PROJECT_RUNNER_TYPE_VALUES = ['LOCAL', 'SSH'] as const;
const PROJECT_STATUS_VALUES = ['ACTIVE', 'PAUSED', 'ARCHIVED'] as const;

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

  @ApiProperty({ example: '/var/mini-deploy/apps/my-app', nullable: true })
  localRepoPath!: string | null;

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
};

export function toProjectDetailDto(
  project: ProjectDetailWithDeployments,
): ProjectDetailDto {
  const latestDeploy = project.deployments[0];

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
    localRepoPath: project.localRepoPath,
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
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
