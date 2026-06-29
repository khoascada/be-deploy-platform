import type {
  DeploymentStatus,
  DeploymentTrigger,
  LogLevel,
  LogStream,
  ProjectStatus,
  RunnerType,
} from '@prisma/client';

export interface DeploymentJobData {
  deploymentId: string;
}

export interface DeploymentCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface DeploymentExecutionContext {
  id: string;
  projectId: string;
  deploymentNumber: number;
  trigger: DeploymentTrigger;
  status: DeploymentStatus;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
  imageTag: string | null;
  containerId: string | null;
  errorMessage: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    ownerId: string;
    slug: string;
    repoFullName: string;
    deployBranch: string;
    rootDirectory: string;
    dockerfilePath: string;
    buildContext: string;
    runnerType: RunnerType;
    containerPort: number;
    hostPort: number | null;
    containerName: string | null;
    imageName: string | null;
    status: ProjectStatus;
  };
}

export interface DeploymentLogInput {
  deploymentId: string;
  projectId: string;
  seq: number;
  level: LogLevel;
  stream: LogStream;
  message: string;
}

export interface DeploymentSuccessInput {
  imageTag: string;
  containerId: string;
}

export interface DeploymentFailureInput {
  errorMessage: string;
}

export interface DeploymentResolvedCommitInput {
  commitSha: string;
  commitMessage: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
}
