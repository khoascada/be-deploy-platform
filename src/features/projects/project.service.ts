import type { PaginationDto } from '@/common/dto/pagination.dto';
import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { Injectable } from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import type { CreateProjectInput } from './schemas/project.schema';

const PROJECT_SLUG_CONFLICT_MESSAGE = 'Project slug already exists';

@Injectable()
export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  async findAll(pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.projects.findAll({ skip, take: pagination.limit }),
      this.projects.count(),
    ]);
    return {
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async createProject(ownerId: string, input: CreateProjectInput) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = await this.buildUniqueSlug(ownerId, input.name);

      try {
        return await this.projects.create({
          ownerId,
          githubRepoId: input.githubRepoId,
          name: input.name,
          slug,
          repoFullName: input.repoFullName,
          repoOwner: input.repoOwner,
          repoName: input.repoName,
          repoUrl: input.repoUrl,
          githubDefaultBranch: input.githubDefaultBranch,
          deployBranch: input.deployBranch,
          rootDirectory: input.rootDirectory,
          dockerfilePath: input.dockerfilePath,
          buildContext: input.buildContext,
          containerPort: input.containerPort,
          hostPort: input.hostPort,
          autoDeploy: input.autoDeploy,
        });
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
    const existingSlugs = await this.projects.findSlugsByBase(ownerId, baseSlug);
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

function slugify(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'project';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
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
