import { DEPLOYMENT_ERROR_CODE, PROJECT_ERROR_CODE } from '@/common/constants';
import {
  NotFoundError,
  ValidationError,
} from '@/common/exceptions/app.exceptions';
import { Injectable } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { ProjectRepository } from '../projects/project.repository';
import { DeploymentRepository } from './deployment.repository';
import {
  type DeploymentResponseDto,
  toDeploymentResponseDto,
} from './dto/deployment-response.dto';

const REQUIRED_DEPLOY_STRING_FIELDS = [
  'deployBranch',
  'containerName',
  'imageName',
  'dockerfilePath',
  'buildContext',
] as const;

@Injectable()
export class DeploymentService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly deployments: DeploymentRepository,
  ) {}

  async createManualDeployment(
    userId: string,
    projectId: string,
  ): Promise<DeploymentResponseDto> {
    const project = await this.projects.findById(projectId);

    if (!project) {
      throw new NotFoundError(
        'Project not found',
        PROJECT_ERROR_CODE.PROJECT_NOT_FOUND,
      );
    }

    if (project.ownerId !== userId) {
      throw new NotFoundError(
        'Not found or not accessible',
        PROJECT_ERROR_CODE.NOT_ACCESS_TO_PROJECT,
      );
    }

    if (project.status !== 'ACTIVE') {
      throw new ValidationError(
        'Project must be ACTIVE before deploying',
        undefined,
        DEPLOYMENT_ERROR_CODE.PROJECT_NOT_ACTIVE,
      );
    }

    if (project.runnerType !== 'LOCAL') {
      throw new ValidationError(
        'Project runner type does not support manual deployments',
        undefined,
        DEPLOYMENT_ERROR_CODE.PROJECT_RUNNER_NOT_SUPPORTED,
      );
    }

    const missingFields = findMissingDeployConfigFields(project);
    if (missingFields.length > 0) {
      throw new ValidationError(
        'Project deploy configuration is incomplete',
        { missingFields },
        DEPLOYMENT_ERROR_CODE.PROJECT_DEPLOY_CONFIG_MISSING,
      );
    }

    const deployment = await this.deployments.createManualDeployment(
      project.id,
      project.deployBranch,
    );

    return toDeploymentResponseDto(deployment);
  }
}

function findMissingDeployConfigFields(project: Project) {
  const missingFields: string[] = [];

  for (const field of REQUIRED_DEPLOY_STRING_FIELDS) {
    const value = project[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      missingFields.push(field);
    }
  }

  if (project.hostPort === null || project.hostPort === undefined) {
    missingFields.push('hostPort');
  }

  if (project.containerPort === null || project.containerPort === undefined) {
    missingFields.push('containerPort');
  }
  console.log('missingFields', missingFields);
  return missingFields;
}
