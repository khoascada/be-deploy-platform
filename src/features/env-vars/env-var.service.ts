import {
  COMMON_ERROR_CODE,
  PROJECT_ERROR_CODE,
} from '@/common/constants';
import { NotFoundError } from '@/common/exceptions/app.exceptions';
import type { EnvVars } from '@/config/env.validation';
import { ProjectRepository } from '@/features/projects/project.repository';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toEnvVarResponseDto } from './dto/env-var-response.dto';
import { encryptEnvVarValue } from './env-var-cipher';
import { EnvVarRepository } from './env-var.repository';
import type {
  CreateEnvVarInput,
  UpdateEnvVarInput,
} from './schemas/env-var.schema';

@Injectable()
export class EnvVarService {
  constructor(
    private readonly envVars: EnvVarRepository,
    private readonly projects: ProjectRepository,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  async getProjectEnvVars(userId: string, projectId: string) {
    await this.assertProjectAccess(userId, projectId);
    const items = await this.envVars.findByProjectId(projectId);
    return items.map(toEnvVarResponseDto);
  }

  async createProjectEnvVar(
    userId: string,
    projectId: string,
    input: CreateEnvVarInput,
  ) {
    await this.assertProjectAccess(userId, projectId);
    const envVar = await this.envVars.create({
      projectId,
      key: input.key,
      scope: input.scope,
      isEnabled: input.isEnabled,
      valueEncrypted: encryptEnvVarValue(
        input.value,
        this.getEncryptionKey(),
      ),
    });

    return toEnvVarResponseDto(envVar);
  }

  async updateProjectEnvVar(
    userId: string,
    projectId: string,
    envVarId: string,
    input: UpdateEnvVarInput,
  ) {
    await this.assertProjectAccess(userId, projectId);
    const envVar = await this.assertEnvVarAccess(projectId, envVarId);

    const updated = await this.envVars.update(envVar.id, {
      ...(input.key !== undefined ? { key: input.key } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.value !== undefined
        ? {
            valueEncrypted: encryptEnvVarValue(
              input.value,
              this.getEncryptionKey(),
            ),
          }
        : {}),
    });

    return toEnvVarResponseDto(updated);
  }

  async deleteProjectEnvVar(userId: string, projectId: string, envVarId: string) {
    await this.assertProjectAccess(userId, projectId);
    const envVar = await this.assertEnvVarAccess(projectId, envVarId);
    await this.envVars.delete(envVar.id);
  }

  private async assertProjectAccess(userId: string, projectId: string) {
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

    return project;
  }

  private async assertEnvVarAccess(projectId: string, envVarId: string) {
    const envVar = await this.envVars.findById(envVarId);

    if (!envVar || envVar.projectId !== projectId) {
      throw new NotFoundError(
        'Environment variable not found',
        COMMON_ERROR_CODE.NOT_FOUND,
      );
    }

    return envVar;
  }

  private getEncryptionKey() {
    const encryptionKey = this.config.get('ENV_VAR_ENCRYPTION_KEY', {
      infer: true,
    });

    if (!encryptionKey) {
      throw new Error('ENV_VAR_ENCRYPTION_KEY is not configured');
    }

    return encryptionKey;
  }
}
