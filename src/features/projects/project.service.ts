import { COMMON_ERROR_CODE, PROJECT_ERROR_CODE } from '@/common/constants';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import {
  ConflictError,
  NotFoundError,
} from '@/common/exceptions/app.exceptions';
import { Injectable } from '@nestjs/common';
import { GithubService } from '../github/github.service';
import { toProjectDetailDto } from './dto/project-detail-response.dto';
import { toProjectListResponseDto } from './dto/project-list-response.dto';
import { ProjectRepository } from './project.repository';
import type { CreateProjectInput } from './schemas/project.schema';
import { escapeRegExp, slugify } from './utils/project.utils';

const PROJECT_SLUG_CONFLICT_MESSAGE = 'Project slug already exists';
const CONTAINER_NAME_CONFLICT_MESSAGE = 'Container name already exists';
const MAX_SLUG_ATTEMPTS = 5;
const MAX_CONTAINER_NAME_ATTEMPTS = 5;

@Injectable()
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly github: GithubService,
  ) {}

  async findAllByUserId(userId: string, pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.projects.findAll({ skip, take: pagination.limit, userId }),
      this.projects.count(userId),
    ]);

    return toProjectListResponseDto({
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  }

  async getDetail(userId: string, id: string) {
    const project = await this.projects.findById(id);

    if (!project) {
      throw new NotFoundError('Project not found', COMMON_ERROR_CODE.NOT_FOUND);
    }

    if (project.ownerId !== userId) {
      throw new NotFoundError(
        'Not found or not accessible',
        PROJECT_ERROR_CODE.NOT_ACCESS_TO_PROJECT,
      );
    }

    return toProjectDetailDto(project);
  }

  async createProject(ownerId: string, input: CreateProjectInput) {
    const repo = await this.github.resolveRepositoryById(
      ownerId,
      input.githubRepoId,
    );

    // Retry slug generation a few times in case another request creates the same slug first.
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const slug = await this.buildUniqueSlug(ownerId, input.name);
      const imageName = this.buildImageName(slug);
      let shouldRetrySlug = false;

      for (
        let containerAttempt = 0;
        containerAttempt < MAX_CONTAINER_NAME_ATTEMPTS;
        containerAttempt += 1
      ) {
        const containerName = await this.buildUniqueContainerName(slug);

        try {
          const project = await this.projects.create({
            ownerId,
            githubRepoId: input.githubRepoId,
            name: input.name,
            slug,
            repoFullName: repo.fullName,
            repoOwner: repo.owner.login,
            repoName: repo.name,
            repoUrl: repo.url,
            githubDefaultBranch: repo.defaultBranch,
            deployBranch: input.deployBranch,
            rootDirectory: input.rootDirectory,
            dockerfilePath: input.dockerfilePath,
            buildContext: input.buildContext,
            containerPort: input.containerPort,
            hostPort: input.hostPort,
            containerName,
            imageName,
            autoDeploy: input.autoDeploy,
            webhookId: null,
            webhookSecretEncrypted: null,
          });

          try {
            const { webhookId, webhookSecretEncrypted } =
              await this.github.createRepositoryWebhook(
                ownerId,
                repo.owner.login,
                repo.name,
              );
            const updated = await this.projects.updateWebhookConfig(
              project.id,
              webhookId,
              webhookSecretEncrypted,
            );
            return withWebhookProvisionStatus(updated);
          } catch {
            return withWebhookProvisionStatus(project);
          }
        } catch (error) {
          if (isContainerNameConflict(error)) {
            continue;
          }

          if (isSlugConflict(error)) {
            shouldRetrySlug = true;
            break;
          }

          throw error;
        }
      }

      if (shouldRetrySlug) {
        continue;
      }

      throw new ConflictError(
        CONTAINER_NAME_CONFLICT_MESSAGE,
        PROJECT_ERROR_CODE.CONTAINER_NAME_ALREADY_EXISTS,
      );
    }

    throw new ConflictError(
      PROJECT_SLUG_CONFLICT_MESSAGE,
      PROJECT_ERROR_CODE.PROJECT_SLUG_ALREADY_EXISTS,
    );
  }

  private async buildUniqueSlug(ownerId: string, name: string) {
    const baseSlug = slugify(name);
    const existingSlugs = await this.projects.findSlugsByBase(
      ownerId,
      baseSlug,
    );
    const exactMatch = new Set(existingSlugs);

    if (!exactMatch.has(baseSlug)) {
      return baseSlug;
    }

    let nextSuffix = 2;
    const suffixPattern = new RegExp(`^${escapeRegExp(baseSlug)}-(\\d+)$`);

    for (const slug of existingSlugs) {
      const match = suffixPattern.exec(slug);
      if (!match) {
        continue;
      }

      const suffix = Number(match[1]);
      if (suffix >= nextSuffix) {
        nextSuffix = suffix + 1;
      }
    }

    return `${baseSlug}-${nextSuffix}`;
  }

  private buildImageName(slug: string) {
    return `mini-deploy/${slug}`;
  }

  private async buildUniqueContainerName(baseName: string) {
    const existingNames = await this.projects.findContainerNamesByBase(baseName);
    const exactMatch = new Set(existingNames);

    if (!exactMatch.has(baseName)) {
      return baseName;
    }

    let nextSuffix = 2;
    const suffixPattern = new RegExp(`^${escapeRegExp(baseName)}-(\\d+)$`);

    for (const name of existingNames) {
      const match = suffixPattern.exec(name);
      if (!match) {
        continue;
      }

      const suffix = Number(match[1]);
      if (suffix >= nextSuffix) {
        nextSuffix = suffix + 1;
      }
    }

    return `${baseName}-${nextSuffix}`;
  }
}

function isSlugConflict(error: unknown): error is ConflictError {
  return isConflictWithCode(
    error,
    PROJECT_ERROR_CODE.PROJECT_SLUG_ALREADY_EXISTS,
  );
}

function isContainerNameConflict(error: unknown): error is ConflictError {
  return isConflictWithCode(
    error,
    PROJECT_ERROR_CODE.CONTAINER_NAME_ALREADY_EXISTS,
  );
}

function isConflictWithCode(
  error: unknown,
  expectedCode: string,
): error is ConflictError {
  if (!(error instanceof ConflictError)) {
    return false;
  }

  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    response.code === expectedCode
  );
}

function withWebhookProvisionStatus<
  T extends { webhookId: string | null; webhookSecretEncrypted?: unknown },
>(project: T) {
  const { ...rest } = project;

  return {
    ...rest,
    isWebhookProvisioned: project.webhookId !== null,
  };
}
