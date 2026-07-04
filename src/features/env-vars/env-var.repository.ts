import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const ENV_VAR_KEY_CONFLICT_MESSAGE =
  'Environment variable key already exists in this project';

@Injectable()
export class EnvVarRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProjectId(projectId: string) {
    return this.prisma.envVar.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.envVar.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.EnvVarUncheckedCreateInput) {
    try {
      return await this.prisma.envVar.create({ data });
    } catch (error) {
      throwUniqueKeyConflict(error);
      throw error;
    }
  }

  async update(id: string, data: Prisma.EnvVarUncheckedUpdateInput) {
    try {
      return await this.prisma.envVar.update({
        where: { id },
        data,
      });
    } catch (error) {
      throwUniqueKeyConflict(error);
      throw error;
    }
  }

  delete(id: string) {
    return this.prisma.envVar.delete({
      where: { id },
    });
  }
}

function throwUniqueKeyConflict(error: unknown): never | void {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    error.code !== 'P2002'
  ) {
    return;
  }

  const targets = getUniqueTargets(error);
  if (targets.includes('projectId') && targets.includes('key')) {
    throw new ConflictError(
      ENV_VAR_KEY_CONFLICT_MESSAGE,
      COMMON_ERROR_CODE.CONFLICT,
    );
  }
}

function getUniqueTargets(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('meta' in error) ||
    typeof error.meta !== 'object' ||
    error.meta === null ||
    !('target' in error.meta) ||
    !Array.isArray(error.meta.target)
  ) {
    return [] as string[];
  }

  return error.meta.target.filter(
    (value): value is string => typeof value === 'string',
  );
}
