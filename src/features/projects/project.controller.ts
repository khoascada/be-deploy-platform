import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { DeploymentRealtimeService } from '@/features/deployments/api/deployment-realtime.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import { toDeploymentCreatedEvent } from '@/features/deployments/shared/types/deployment-created-events';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectDetailDto } from './dto/project-detail-response.dto';
import { ProjectListResponseDto } from './dto/project-list-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectService } from './project.service';

@ApiTags('projects')
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projects: ProjectService,
    private readonly deployments: DeploymentRepository,
    private readonly realtime: DeploymentRealtimeService,
  ) {}

  @ApiOperation({ summary: 'Stream new deployments created for a project' })
  @Get(':id/deployments/stream')
  async streamDeployments(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Res() response: Response,
  ) {
    await this.projects.getDetail(userId, projectId);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write(': connected\n\n');

    const latest = await this.deployments.findLatestByProjectId(projectId);
    if (latest) {
      this.realtime.writeSseEvent(response, toDeploymentCreatedEvent(latest));
    }

    const unsubscribe = this.realtime.subscribeProject(projectId, (event) => {
      this.realtime.writeSseEvent(response, event);
    });
    const heartbeat = setInterval(
      () => response.write(': heartbeat\n\n'),
      15_000,
    );
    response.req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      response.end();
    });
  }

  @ApiOperation({ summary: 'Get list projects' })
  @ApiOkResponse({ type: ProjectListResponseDto })
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.findAllByUserId(userId, pagination);
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

  @ApiOperation({ summary: 'Update project settings' })
  @ApiParam({ name: 'id', example: 'clx123abc456def789ghi012' })
  @ApiOkResponse({ type: ProjectDetailDto })
  @ApiConflictResponse({
    description: 'Project has an active deployment or host port is in use',
  })
  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projects.updateProject(userId, projectId, body);
  }

  @ApiOperation({ summary: 'Delete project' })
  @ApiParam({ name: 'id', example: 'clx123abc456def789ghi012' })
  @ApiNoContentResponse({ description: 'Project deleted successfully' })
  @ApiConflictResponse({ description: 'Project has an active deployment' })
  @ApiBadGatewayResponse({
    description: 'Failed to delete the GitHub webhook before removing the project',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ): Promise<void> {
    await this.projects.deleteProject(userId, projectId);
  }
}

