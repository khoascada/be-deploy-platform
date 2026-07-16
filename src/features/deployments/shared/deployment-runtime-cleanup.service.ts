import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import type { EnvVars } from '@/config/env.validation';
import { DeploymentCommandRunnerService } from '@/features/deployments/worker/deployment-command-runner.service';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface ProjectRuntimeCleanupTarget {
  id: string;
  slug: string;
  runnerType: string;
  containerName: string | null;
  imageName: string | null;
}

@Injectable()
export class ProjectRuntimeCleanupService {
  private readonly logger = new Logger(ProjectRuntimeCleanupService.name);

  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly commandRunner: DeploymentCommandRunnerService,
  ) {}

  async cleanupProjectResources(project: ProjectRuntimeCleanupTarget) {
    if (project.runnerType !== 'LOCAL') {
      throw new ConflictError(
        'Project runner type does not support runtime cleanup',
        COMMON_ERROR_CODE.CONFLICT,
      );
    }

    await this.removeProjectContainer(project.containerName);
    await this.removeProjectImages(project.imageName);
    await this.removeProjectWorkspace(project);
  }

  private async removeProjectContainer(containerName: string | null) {
    if (!containerName) {
      this.logger.log('Skipping container cleanup because containerName is empty');
      return;
    }

    const containerId = await this.findContainerId(containerName);
    if (!containerId) {
      this.logger.log(`Skipping container cleanup because ${containerName} does not exist`);
      return;
    }

    // Stop and remove the project's Docker container before deleting metadata.
    await this.commandRunner.run('docker', ['rm', '-f', containerName]);
    this.logger.log(`Removed Docker container ${containerName}`);
  }

  private async removeProjectImages(imageName: string | null) {
    if (!imageName) {
      this.logger.log('Skipping image cleanup because imageName is empty');
      return;
    }

    const imageReferences = await this.findImageReferences(imageName);
    if (imageReferences.length === 0) {
      this.logger.log(`Skipping image cleanup because ${imageName}:* does not exist`);
      return;
    }

    // Remove all Docker image tags produced for this project.
    for (const imageReference of imageReferences) {
      await this.commandRunner.run('docker', ['rmi', '-f', imageReference]);
      this.logger.log(`Removed Docker image ${imageReference}`);
    }
  }

  private async removeProjectWorkspace(project: ProjectRuntimeCleanupTarget) {
    const repositoriesRoot = path.resolve(
      this.config.get('REPOSITORIES_ROOT', { infer: true }),
    );
    const workspacePath = path.resolve(
      repositoriesRoot,
      `${project.id}-${project.slug}`,
    );

    // Guard the recursive delete so it cannot escape REPOSITORIES_ROOT.
    if (!isChildPath(repositoriesRoot, workspacePath)) {
      throw new ConflictError(
        'Project workspace path is outside repositories root',
        COMMON_ERROR_CODE.CONFLICT,
      );
    }

    // Remove the cloned repository workspace for this project.
    await fs.rm(workspacePath, { recursive: true, force: true });
    this.logger.log(`Removed project workspace ${workspacePath}`);
  }

  private async findContainerId(containerName: string) {
    const result = await this.commandRunner.run('docker', [
      'ps',
      '-aq',
      '--filter',
      `name=^${containerName}$`,
    ]);

    return result.stdout.trim();
  }

  private async findImageReferences(imageName: string) {
    const result = await this.commandRunner.run('docker', [
      'images',
      '--format',
      '{{.Repository}}:{{.Tag}}',
      '--filter',
      `reference=${imageName}:*`,
    ]);

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.endsWith(':<none>'));
  }
}

function isChildPath(parentPath: string, childPath: string) {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath.length > 0 &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  );
}
