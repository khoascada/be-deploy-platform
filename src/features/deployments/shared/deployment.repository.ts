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
import type { Prisma } from '@prisma/client';
import {
  DeploymentStatus,
  DeploymentTrigger,
  WebhookEventStatus,
} from '@prisma/client';

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
    // ghi webhookEvent và tạo Deployment transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Kiểm tra nhanh delivery này đã được ghi nhận chưa.
      // GitHub có thể retry cùng một webhook với cùng githubDeliveryId.
      const duplicate = await tx.webhookEvent.findUnique({
        where: { githubDeliveryId: input.githubDeliveryId },
      });
      // Đã tồn tại thì không tạo thêm event hoặc deployment.
      if (duplicate) {
        return { duplicate: true, deployment: null };
      }

      // ngăn ko cho transaction khác cùng projectId chạy.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${input.projectId}))
      `;

      // 3. Kiểm tra duplicate lần nữa sau khi lấy lock.
      // Trong lúc request hiện tại chờ lock, một request khác có thể đã ghi event.
      const duplicateAfterLock = await tx.webhookEvent.findUnique({
        where: { githubDeliveryId: input.githubDeliveryId },
      });
      if (duplicateAfterLock) {
        return { duplicate: true, deployment: null };
      }

      const now = new Date();
      const status = resolveInitialWebhookStatus(input);
      // 4. Ghi lại webhook delivery để audit, debug và chống xử lý trùng.
      const event = await tx.webhookEvent.create({
        data: {
          projectId: input.projectId,
          githubDeliveryId: input.githubDeliveryId,
          eventName: input.eventName,
          action: input.action,
          signature: input.signature,
          isVerified: input.isVerified,
          payload: input.payload,
          status,
          ...(isTerminalWebhookStatus(status)
            ? {
                processedAt: now,
                statusReason:
                  input.ignoreReason ?? 'Invalid or missing push payload',
              }
            : {}),
        },
      });

      //  Dừng tại đây nếu event không thể tạo deployment:
      //
      // - Không có push: event không phải push hoặc payload push không parse được.
      // - Có ignoreReason: sai repo/branch, auto deploy tắt, project inactive...
      // - Chưa verify: signature không hợp lệ.
      //
      // WebhookEvent vẫn được lưu, nhưng không tạo Deployment.
      if (!input.push || input.ignoreReason || !input.isVerified) {
        return { duplicate: false, deployment: null };
      }

      // 6. Kiểm tra project hiện có deployment đang chạy hay không.
      const activeDeployment = await tx.deployment.findFirst({
        where: {
          projectId: input.projectId,
          status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
        },
      });

      // Nếu đang có deployment chạy, giữ event mới ở trạng thái PENDING.
      //
      // Sau khi deployment hiện tại hoàn tất,
      // promoteLatestPendingGithubPush() có thể xử lý push pending mới nhất.
      if (activeDeployment) {
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { status: WebhookEventStatus.PENDING },
        });
        return { duplicate: false, deployment: null };
      }

      // 7. Trước khi deploy push mới, đánh dấu các push pending cũ của project
      // là đã bị push mới thay thế, để sau này chúng không được deploy nữa.
      await tx.webhookEvent.updateMany({
        where: {
          projectId: input.projectId,
          // Không cập nhật chính event vừa tạo.
          id: { not: event.id },
          // Chỉ supersede các push hợp lệ đang pending.
          eventName: 'push',
          isVerified: true,
          status: WebhookEventStatus.PENDING,
        },
        data: {
          status: WebhookEventStatus.SUPERSEDED,
          processedAt: now,
          statusReason: 'Superseded by a newer push',
        },
      });

      // 8. Tạo Deployment từ thông tin branch và commit của GitHub push.
      // githubDeliveryId liên kết deployment với webhook đã kích hoạt nó.
      const deployment = await createGithubDeployment(
        tx,
        input.projectId,
        input.githubDeliveryId,
        input.push,
      );
      // 9. Đánh dấu webhook hiện tại đã được xử lý thành công.
      await tx.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          statusReason: null,
          processedAt: now,
        },
      });
      return { duplicate: false, deployment };
    });
  }

  async promoteLatestPendingGithubPush(projectId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${projectId}))
      `;
      // nếu có active deployment hiện tại thì return
      const activeDeployment = await tx.deployment.findFirst({
        where: {
          projectId,
          status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
        },
      });
      if (activeDeployment) return null;

      // tìm những webhookEvent đang pending push của projectId
      const pending = await tx.webhookEvent.findMany({
        where: {
          projectId,
          eventName: 'push',
          isVerified: true,
          status: WebhookEventStatus.PENDING,
        },
        orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      });
      const latest = pending[0];
      if (!latest) return null;

      // parse payload để lấy info
      const push = parseStoredPush(latest.payload);
      const now = new Date();
      if (!push) {
        await tx.webhookEvent.update({
          where: { id: latest.id },
          data: {
            status: WebhookEventStatus.FAILED,
            processedAt: now,
            statusReason: 'Invalid stored push payload',
          },
        });
        return null;
      }
      // vd có B,C,D -> chỉ push D rồi loại các push cũ ko push nữa.
      if (pending.length > 1) {
        await tx.webhookEvent.updateMany({
          where: { id: { in: pending.slice(1).map((event) => event.id) } },
          data: {
            status: WebhookEventStatus.SUPERSEDED,
            processedAt: now,
            statusReason: 'Superseded by a newer push',
          },
        });
      }

      // tạo deployment
      const deployment = await createGithubDeployment(
        tx,
        projectId,
        latest.githubDeliveryId,
        push,
      );
      // update webhook đã đc xử lý
      await tx.webhookEvent.update({
        where: { id: latest.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          statusReason: null,
          processedAt: now,
        },
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

  // update commit info khi create manual
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

function resolveInitialWebhookStatus(
  input: GithubWebhookRecordInput,
): WebhookEventStatus {
  if (!input.isVerified || (!input.push && !input.ignoreReason)) {
    return WebhookEventStatus.FAILED;
  }
  if (input.ignoreReason) return WebhookEventStatus.IGNORED;
  return WebhookEventStatus.RECEIVED;
}

function isTerminalWebhookStatus(status: WebhookEventStatus): boolean {
  return (
    status === WebhookEventStatus.FAILED ||
    status === WebhookEventStatus.IGNORED
  );
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

function parseStoredPush(
  payload: Prisma.JsonValue,
): GithubPushDeploymentInput | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null;
  const value = payload as Record<string, Prisma.JsonValue>;
  const ref = value.ref;
  if (typeof ref !== 'string' || !ref.startsWith('refs/heads/')) return null;
  const head = value.head_commit;
  const commit =
    head && typeof head === 'object' && !Array.isArray(head)
      ? (head as Record<string, Prisma.JsonValue>)
      : null;
  const author =
    commit?.author &&
    typeof commit.author === 'object' &&
    !Array.isArray(commit.author)
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
