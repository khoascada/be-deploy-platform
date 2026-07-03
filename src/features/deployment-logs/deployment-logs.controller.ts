import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DeploymentLogsService } from '@/features/logs/deployment-logs.service';
import { DeploymentLogResponseDto } from '@/features/logs/dto/deployment-log-response.dto';
import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('deployments')
@Controller('projects/:projectId/deployments')
export class DeploymentLogsController {
  constructor(private readonly deploymentLogs: DeploymentLogsService) {}

  @ApiOperation({ summary: 'Get deployment logs for a project deployment' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiParam({ name: 'deploymentId', example: 'deployment-123' })
  @ApiOkResponse({ type: DeploymentLogResponseDto, isArray: true })
  @Get(':deploymentId/logs')
  findLogs(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.deploymentLogs.getDeploymentLogs(
      userId,
      projectId,
      deploymentId,
    );
  }
}
