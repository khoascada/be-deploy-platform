import { DEPLOYMENT_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DeploymentStatus, DeploymentTrigger } from '@prisma/client';
import { ACTIVE_DEPLOYMENT_STATUSES } from './deployment.constants';
import type {
  DeploymentExecutionContext,
  DeploymentFailureInput,
  DeploymentLogInput,
  DeploymentResolvedCommitInput,
  DeploymentSuccessInput,
} from './deployment.types';

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

  appendLog(data: DeploymentLogInput) {
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

function calculateDurationMs(
  startedAt: Date | null | undefined,
  finishedAt: Date,
) {
  if (!startedAt) {
    return 0;
  }

  return Math.max(0, finishedAt.getTime() - startedAt.getTime());
}
