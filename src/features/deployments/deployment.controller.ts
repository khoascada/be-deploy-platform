import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Controller, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { DeploymentResponseDto } from './dto/deployment-response.dto';
import { DeploymentService } from './deployment.service';

@ApiTags('deployments')
@Controller('projects/:projectId/deployments')
export class DeploymentController {
  constructor(private readonly deployments: DeploymentService) {}

  @ApiOperation({ summary: 'Create a manual deployment for a project' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiCreatedResponse({ type: DeploymentResponseDto })
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.deployments.createManualDeployment(userId, projectId);
  }
}
