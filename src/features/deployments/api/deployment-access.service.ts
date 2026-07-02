import { COMMON_ERROR_CODE, PROJECT_ERROR_CODE } from '@/common/constants';
import { NotFoundError } from '@/common/exceptions/app.exceptions';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeploymentAccessService {
  constructor(private readonly deployments: DeploymentRepository) {}

  async assertDeploymentAccess(
    userId: string,
    projectId: string,
    deploymentId: string,
  ) {
    const deployment = await this.deployments.findById(deploymentId);

    if (!deployment) {
      throw new NotFoundError(
        'Deployment not found',
        COMMON_ERROR_CODE.NOT_FOUND,
      );
    }

    if (
      deployment.projectId !== projectId ||
      deployment.project.ownerId !== userId
    ) {
      throw new NotFoundError(
        'Not found or not accessible',
        PROJECT_ERROR_CODE.NOT_ACCESS_TO_PROJECT,
      );
    }

    return deployment;
  }
}
