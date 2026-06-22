import type { PaginationDto } from '@/common/dto/pagination.dto';
import { Injectable } from '@nestjs/common';
import { ProjectRepository } from './project.repository';

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
}
