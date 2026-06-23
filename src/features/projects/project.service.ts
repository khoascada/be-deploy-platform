import { COMMON_ERROR_CODE } from '@/common/constants';
import type { PaginationDto } from '@/common/dto/pagination.dto';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { Injectable } from '@nestjs/common';
import { GithubService } from '../github/github.service';
import { ProjectRepository } from './project.repository';
import type { CreateProjectInput } from './schemas/project.schema';
import { escapeRegExp, slugify } from './utils/project.utils';

const PROJECT_SLUG_CONFLICT_MESSAGE = 'Project slug already exists';

@Injectable()
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly github: GithubService,
  ) {}

  async findAll(pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.projects.findAll({ skip, take: pagination.limit }),
      this.projects.count(),
    ]);

    return {
      items: items.map(withWebhookProvisionStatus),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async createProject(ownerId: string, input: CreateProjectInput) {
    const repo = await this.github.resolveRepositoryById(
      ownerId,
      input.githubRepoId,
    );

    // Retry slug generation a few times in case another request creates the same slug first.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = await this.buildUniqueSlug(ownerId, input.name);

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
        if (isSlugConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictError(
      PROJECT_SLUG_CONFLICT_MESSAGE,
      COMMON_ERROR_CODE.CONFLICT,
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
}

function isSlugConflict(error: unknown): error is ConflictError {
  if (!(error instanceof ConflictError)) {
    return false;
  }

  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'message' in response &&
    response.message === PROJECT_SLUG_CONFLICT_MESSAGE
  );
}

function withWebhookProvisionStatus<T extends { webhookId: string | null; webhookSecretEncrypted?: unknown }>(
  project: T,
) {
  const { webhookSecretEncrypted: _webhookSecretEncrypted, ...rest } = project;

  return {
    ...rest,
    isWebhookProvisioned: project.webhookId !== null,
  };
}
