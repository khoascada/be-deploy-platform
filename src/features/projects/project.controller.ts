import { PaginationDto } from '@/common/dto/pagination.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectDetailDto } from './dto/project-detail-response.dto';
import { ProjectListResponseDto } from './dto/project-list-response.dto';
import { ProjectService } from './project.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @ApiOperation({ summary: 'Get list projects' })
  @ApiOkResponse({ type: ProjectListResponseDto })
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.projects.findAll(pagination);
  }

  @ApiOperation({ summary: 'Get project detail' })
  @ApiParam({ name: 'id', example: 'clx123abc456def789ghi012' })
  @ApiOkResponse({ type: ProjectDetailDto })
  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.projects.getDetail(userId, id);
  }

  @ApiOperation({ summary: 'Create project' })
  @Post()
  create(@CurrentUser('id') userId: string, @Body() body: CreateProjectDto) {
    return this.projects.createProject(userId, body);
  }
}
