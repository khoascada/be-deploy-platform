import type { PaginationDto } from '@/common/dto/pagination.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectService } from './project.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @ApiOperation({ summary: 'Get list projects' })
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.projects.findAll(pagination);
  }
}
