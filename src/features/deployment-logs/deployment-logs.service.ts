import { DeploymentAccessService } from '@/features/deployments/api/deployment-access.service';
import {
  DeploymentLogResponseDto,
  toDeploymentLogResponseDto,
} from '@/features/logs/dto/deployment-log-response.dto';
import { LogsRepository } from '@/features/logs/logs.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeploymentLogsService {
  constructor(
    private readonly deploymentAccess: DeploymentAccessService,
    private readonly logs: LogsRepository,
  ) {}

  async getDeploymentLogs(
    userId: string,
    projectId: string,
    deploymentId: string,
  ): Promise<DeploymentLogResponseDto[]> {
    await this.deploymentAccess.assertDeploymentAccess(
      userId,
      projectId,
      deploymentId,
    );

    const logs = await this.logs.findLogs(deploymentId);
    return logs.map(toDeploymentLogResponseDto);
  }
}
