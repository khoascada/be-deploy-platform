import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { PrismaService } from '@/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

const HOST_PORT_CONFLICT_MESSAGE = 'Host port already exists';
const GITHUB_REPO_CONFLICT_MESSAGE = 'GitHub repository already exists for this user';
const PROJECT_SLUG_CONFLICT_MESSAGE = 'Project slug already exists';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(args: { skip: number; take: number }) {
    return this.prisma.project.findMany({
      skip: args.skip,
      take: args.take,
      orderBy: { id: 'desc' },
    });
  }

  count() {
    return this.prisma.project.count();
  }

  async findSlugsByBase(ownerId: string, baseSlug: string) {
    const items = await this.prisma.project.findMany({
      where: {
        ownerId,
        OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }],
      },
      select: { slug: true },
      orderBy: { slug: 'asc' },
    });

    return items.map((item) => item.slug);
  }

  async create(data: Prisma.ProjectUncheckedCreateInput) {
    try {
      return await this.prisma.project.create({ data });
    } catch (error) {
      const uniqueTargets = getUniqueTargets(error);

      if (includesAllTargets(uniqueTargets, ['hostPort'])) {
        throw new ConflictError(
          HOST_PORT_CONFLICT_MESSAGE,
          COMMON_ERROR_CODE.CONFLICT,
        );
      }

      if (includesAllTargets(uniqueTargets, ['ownerId', 'githubRepoId'])) {
        throw new ConflictError(
          GITHUB_REPO_CONFLICT_MESSAGE,
          COMMON_ERROR_CODE.CONFLICT,
        );
      }

      if (includesAllTargets(uniqueTargets, ['ownerId', 'slug'])) {
        throw new ConflictError(
          PROJECT_SLUG_CONFLICT_MESSAGE,
          COMMON_ERROR_CODE.CONFLICT,
        );
      }

      throw error;
    }
  }
}

function getUniqueTargets(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    error.code !== 'P2002' ||
    !('meta' in error)
  ) {
    return [] as string[];
  }

  const target = (error.meta as { target?: unknown }).target;
  return Array.isArray(target) ? target.filter(isString) : [];
}

function includesAllTargets(targets: string[], expected: string[]) {
  return expected.every((target) => targets.includes(target));
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
