import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateEnvVarDto } from './dto/create-env-var.dto';
import { EnvVarResponseDto } from './dto/env-var-response.dto';
import { UpdateEnvVarDto } from './dto/update-env-var.dto';
import { EnvVarService } from './env-var.service';

@ApiTags('env-vars')
@Controller('projects/:projectId/env-vars')
export class EnvVarController {
  constructor(private readonly envVars: EnvVarService) {}

  @ApiOperation({ summary: 'Get all environment variables for a project' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiOkResponse({ type: EnvVarResponseDto, isArray: true })
  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.envVars.getProjectEnvVars(userId, projectId);
  }

  @ApiOperation({ summary: 'Create an environment variable for a project' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiCreatedResponse({ type: EnvVarResponseDto })
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() body: CreateEnvVarDto,
  ) {
    return this.envVars.createProjectEnvVar(userId, projectId, body);
  }

  @ApiOperation({ summary: 'Update an environment variable for a project' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiParam({ name: 'envVarId', example: 'env_123' })
  @ApiOkResponse({ type: EnvVarResponseDto })
  @Patch(':envVarId')
  update(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('envVarId') envVarId: string,
    @Body() body: UpdateEnvVarDto,
  ) {
    return this.envVars.updateProjectEnvVar(userId, projectId, envVarId, body);
  }

  @ApiOperation({ summary: 'Delete an environment variable for a project' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiParam({ name: 'envVarId', example: 'env_123' })
  @ApiNoContentResponse()
  @Delete(':envVarId')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('envVarId') envVarId: string,
  ) {
    await this.envVars.deleteProjectEnvVar(userId, projectId, envVarId);
  }
}
