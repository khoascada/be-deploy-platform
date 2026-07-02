import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { DeploymentAccessService } from '@/features/deployments/api/deployment-access.service';
import { DeploymentRealtimeService } from '@/features/deployments/api/deployment-realtime.service';
import { DeploymentService } from '@/features/deployments/api/deployment.service';
import { DeploymentResponseDto } from '@/features/deployments/api/dto/deployment-response.dto';
import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('deployments')
@Controller('projects/:projectId/deployments')
export class DeploymentController {
  constructor(
    private readonly deployments: DeploymentService,
    private readonly deploymentAccess: DeploymentAccessService,
    private readonly realtime: DeploymentRealtimeService,
  ) {}

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

  @ApiOperation({ summary: 'Stream deployment logs for a project deployment' })
  @ApiParam({ name: 'projectId', example: 'project-123' })
  @ApiParam({ name: 'deploymentId', example: 'deployment-123' })
  @Get(':deploymentId/logs/stream')
  async streamLogs(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Param('deploymentId') deploymentId: string,
    @Res() response: Response,
  ) {
    await this.deploymentAccess.assertDeploymentAccess(
      userId,
      projectId,
      deploymentId,
    );

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write(': connected\n\n');

    // đăng ký listener
    const unsubscribe = this.realtime.subscribe(deploymentId, (event) => {
      this.realtime.writeSseEvent(response, event);
    });

    response.req.on('close', () => {
      unsubscribe();
      response.end();
    });
  }
}
