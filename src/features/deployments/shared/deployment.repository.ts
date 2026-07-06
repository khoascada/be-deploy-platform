import { DEPLOYMENT_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { ACTIVE_DEPLOYMENT_STATUSES } from '@/features/deployments/shared/constants/deployment.constants';
import type {
  DeploymentExecutionContext,
  DeploymentFailureInput,
  DeploymentLogInput,
  DeploymentLogRecord,
  DeploymentResolvedCommitInput,
  DeploymentSuccessInput,
} from '@/features/deployments/shared/deployment.types';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DeploymentStatus, DeploymentTrigger } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export interface GithubPushDeploymentInput {
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  commitAuthorName: string | null;
  commitAuthorEmail: string | null;
}

export interface GithubWebhookRecordInput {
  projectId: string;
  githubDeliveryId: string;
  eventName: string;
  action: string | null;
  signature: string | null;
  isVerified: boolean;
  payload: Prisma.InputJsonValue;
  ignoreReason?: string;
  push?: GithubPushDeploymentInput;
}

@Injectable()
export class DeploymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createManualDeployment(projectId: string, branch: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${projectId}))
      `;
      const activeDeployment = await tx.deployment.findFirst({
        where: {
          projectId,
          status: {
            in: [...ACTIVE_DEPLOYMENT_STATUSES],
          },
        },
      });

      if (activeDeployment) {
        throw new ConflictError(
          'An active deployment already exists for this project',
          DEPLOYMENT_ERROR_CODE.ACTIVE_DEPLOYMENT_EXISTS,
        );
      }

      const latestDeployment = await tx.deployment.findFirst({
        where: { projectId },
        orderBy: { deploymentNumber: 'desc' },
      });

      const queuedAt = new Date();

      return tx.deployment.create({
        data: {
          projectId,
          deploymentNumber: (latestDeployment?.deploymentNumber ?? 0) + 1,
          trigger: DeploymentTrigger.MANUAL,
          status: DeploymentStatus.QUEUED,
          branch,
          queuedAt,
        },
      });
    });
  }

  async recordGithubWebhook(input: GithubWebhookRecordInput) {
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.webhookEvent.findUnique({
        where: { githubDeliveryId: input.githubDeliveryId },
      });
      if (duplicate) {
        return { duplicate: true, deployment: null };
      }

      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.projectId}))
      `;

      const duplicateAfterLock = await tx.webhookEvent.findUnique({
        where: { githubDeliveryId: input.githubDeliveryId },
      });
      if (duplicateAfterLock) {
        return { duplicate: true, deployment: null };
      }

      const now = new Date();
      const event = await tx.webhookEvent.create({
        data: {
          projectId: input.projectId,
          githubDeliveryId: input.githubDeliveryId,
          eventName: input.eventName,
          action: input.action,
          signature: input.signature,
          isVerified: input.isVerified,
          payload: input.payload,
          ...(input.ignoreReason
            ? { processedAt: now, errorMessage: input.ignoreReason }
            : {}),
        },
      });

      if (!input.push || input.ignoreReason || !input.isVerified) {
        return { duplicate: false, deployment: null };
      }

      const activeDeployment = await tx.deployment.findFirst({
        where: {
          projectId: input.projectId,
          status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
        },
      });
      if (activeDeployment) {
        return { duplicate: false, deployment: null };
      }

      await tx.webhookEvent.updateMany({
        where: {
          projectId: input.projectId,
          id: { not: event.id },
          eventName: 'push',
          isVerified: true,
          processedAt: null,
          errorMessage: null,
        },
        data: {
          processedAt: now,
          errorMessage: 'Superseded by a newer push',
        },
      });

      const deployment = await createGithubDeployment(
        tx,
        input.projectId,
        input.githubDeliveryId,
        input.push,
      );
      await tx.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: now },
      });
      return { duplicate: false, deployment };
    });
  }

  async promoteLatestPendingGithubPush(projectId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${projectId}))
      `;
      const activeDeployment = await tx.deployment.findFirst({
        where: {
          projectId,
          status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
        },
      });
      if (activeDeployment) return null;

      const pending = await tx.webhookEvent.findMany({
        where: {
          projectId,
          eventName: 'push',
          isVerified: true,
          processedAt: null,
          errorMessage: null,
        },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      });
      const latest = pending[0];
      if (!latest) return null;

      const push = parseStoredPush(latest.payload);
      const now = new Date();
      if (!push) {
        await tx.webhookEvent.update({
          where: { id: latest.id },
          data: { processedAt: now, errorMessage: 'Invalid stored push payload' },
        });
        return null;
      }

      if (pending.length > 1) {
        await tx.webhookEvent.updateMany({
          where: { id: { in: pending.slice(1).map((event) => event.id) } },
          data: {
            processedAt: now,
            errorMessage: 'Superseded by a newer push',
          },
        });
      }

      const deployment = await createGithubDeployment(
        tx,
        projectId,
        latest.githubDeliveryId,
        push,
      );
      await tx.webhookEvent.update({
        where: { id: latest.id },
        data: { processedAt: now },
      });
      return deployment;
    });
  }

  findLatestByProjectId(projectId: string) {
    return this.prisma.deployment.findFirst({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { deploymentNumber: 'desc' }],
    });
  }

  findActiveByProjectId(projectId: string) {
    return this.prisma.deployment.findFirst({
      where: {
        projectId,
        status: {
          in: [...ACTIVE_DEPLOYMENT_STATUSES],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  findRecentByProjectId(projectId: string, limit: number) {
    return this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { deploymentNumber: 'desc' }],
      take: limit,
      select: {
        id: true,
        projectId: true,
        deploymentNumber: true,
        trigger: true,
        status: true,
        branch: true,
        commitSha: true,
        commitMessage: true,
        queuedAt: true,
        createdAt: true,
        finishedAt: true,
      },
    });
  }

  async markEnqueueFailed(deploymentId: string, errorMessage: string) {
    const finishedAt = new Date();

    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.FAILED,
        errorMessage,
        finishedAt,
        durationMs: 0,
      },
    });
  }

  async claimQueuedDeployment(
    deploymentId: string,
  ): Promise<DeploymentExecutionContext | null> {
    const deployment = await this.prisma.$transaction(async (tx) => {
      const deploymentIdentity = await tx.deployment.findUnique({
        where: { id: deploymentId },
        select: { projectId: true },
      });

      if (!deploymentIdentity) {
        return null;
      }

      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${deploymentIdentity.projectId}))
      `;

      const activeDeployment = await tx.deployment.findFirst({
        where: {
          projectId: deploymentIdentity.projectId,
          id: { not: deploymentId },
          status: {
            in: [...ACTIVE_DEPLOYMENT_STATUSES],
          },
        },
      });

      if (activeDeployment) {
        throw new ConflictError(
          'An active deployment already exists for this project',
          DEPLOYMENT_ERROR_CODE.ACTIVE_DEPLOYMENT_EXISTS,
        );
      }

      const startedAt = new Date();
      const updated = await tx.deployment.updateMany({
        where: {
          id: deploymentId,
          status: DeploymentStatus.QUEUED,
        },
        data: {
          status: DeploymentStatus.PULLING,
          startedAt,
          errorMessage: null,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      return tx.deployment.findUnique({
        where: { id: deploymentId },
        include: {
          project: {
            select: {
              id: true,
              ownerId: true,
              slug: true,
              repoFullName: true,
              deployBranch: true,
              rootDirectory: true,
              dockerfilePath: true,
              buildContext: true,
              runnerType: true,
              containerPort: true,
              hostPort: true,
              containerName: true,
              imageName: true,
              status: true,
            },
          },
        },
      });
    });

    return deployment;
  }

  updateStatus(
    deploymentId: string,
    status: DeploymentStatus,
    data: { imageTag?: string } = {},
  ) {
    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status,
        ...(data.imageTag ? { imageTag: data.imageTag } : {}),
      },
    });
  }

  saveResolvedCommit(
    deploymentId: string,
    data: DeploymentResolvedCommitInput,
  ) {
    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data,
    });
  }

  findById(deploymentId: string) {
    return this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            slug: true,
          },
        },
      },
    });
  }

  appendLog(data: DeploymentLogInput): Promise<DeploymentLogRecord> {
    return this.prisma.deploymentLog.create({
      data,
    });
  }

  async markSuccess(deploymentId: string, data: DeploymentSuccessInput) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { startedAt: true },
    });
    const finishedAt = new Date();

    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.SUCCESS,
        imageTag: data.imageTag,
        containerId: data.containerId,
        errorMessage: null,
        finishedAt,
        durationMs: calculateDurationMs(deployment?.startedAt, finishedAt),
      },
    });
  }

  async markFailed(deploymentId: string, data: DeploymentFailureInput) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { startedAt: true },
    });
    const finishedAt = new Date();

    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.FAILED,
        errorMessage: data.errorMessage,
        finishedAt,
        durationMs: calculateDurationMs(deployment?.startedAt, finishedAt),
      },
    });
  }
}

async function createGithubDeployment(
  tx: Prisma.TransactionClient,
  projectId: string,
  githubDeliveryId: string,
  push: GithubPushDeploymentInput,
) {
  const latestDeployment = await tx.deployment.findFirst({
    where: { projectId },
    orderBy: { deploymentNumber: 'desc' },
  });
  return tx.deployment.create({
    data: {
      projectId,
      deploymentNumber: (latestDeployment?.deploymentNumber ?? 0) + 1,
      trigger: DeploymentTrigger.GITHUB_PUSH,
      status: DeploymentStatus.QUEUED,
      branch: push.branch,
      commitSha: push.commitSha,
      commitMessage: push.commitMessage,
      commitAuthorName: push.commitAuthorName,
      commitAuthorEmail: push.commitAuthorEmail,
      githubDeliveryId,
      queuedAt: new Date(),
    },
  });
}

function parseStoredPush(payload: Prisma.JsonValue): GithubPushDeploymentInput | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = payload as Record<string, Prisma.JsonValue>;
  const ref = value.ref;
  if (typeof ref !== 'string' || !ref.startsWith('refs/heads/')) return null;
  const head = value.head_commit;
  const commit =
    head && typeof head === 'object' && !Array.isArray(head)
      ? (head as Record<string, Prisma.JsonValue>)
      : null;
  const author =
    commit?.author && typeof commit.author === 'object' && !Array.isArray(commit.author)
      ? (commit.author as Record<string, Prisma.JsonValue>)
      : null;
  return {
    branch: ref.slice('refs/heads/'.length),
    commitSha: typeof commit?.id === 'string' ? commit.id : null,
    commitMessage: typeof commit?.message === 'string' ? commit.message : null,
    commitAuthorName: typeof author?.name === 'string' ? author.name : null,
    commitAuthorEmail: typeof author?.email === 'string' ? author.email : null,
  };
}

function calculateDurationMs(
  startedAt: Date | null | undefined,
  finishedAt: Date,
) {
  if (!startedAt) {
    return 0;
  }

  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}





