import { PaginationDto } from '@/common/dto/pagination.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
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

  @ApiOperation({ summary: 'Create project' })
  @Post()
  create(@CurrentUser('id') userId: string, @Body() body: CreateProjectDto) {
    return this.projects.createProject(userId, body);
  }
}
