import { DEPLOYMENT_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { DeploymentStatus, DeploymentTrigger } from '@prisma/client';

const ACTIVE_DEPLOYMENT_STATUSES = [
  DeploymentStatus.QUEUED,
  DeploymentStatus.PULLING,
  DeploymentStatus.BUILDING,
  DeploymentStatus.DEPLOYING,
] as const;

@Injectable()
export class DeploymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createManualDeployment(projectId: string, branch: string) {
    return this.prisma.$transaction(async (tx) => {
      // lock projectId đang tạo deployment -> request khác muốn tạo phải chờ.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${projectId}))
      `;
      // tìm project này hiện có deployment nào đang processing ko
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

      // tìm latest Deployment để tính deploymentNumber
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
}
