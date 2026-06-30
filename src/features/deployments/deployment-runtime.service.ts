import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { DeploymentCommandRunnerService } from './deployment-command-runner.service';
import { DeploymentLogWriter } from './deployment-log-writer';
import type { DeploymentExecutionContext } from './deployment.types';

@Injectable()
export class DeploymentRuntimeService {
  constructor(
    private readonly commandRunner: DeploymentCommandRunnerService,
  ) {}

  buildImageTag(context: DeploymentExecutionContext) {
    const imageName = ensureRequired(context.project.imageName, 'imageName');
    return `${imageName}:deploy-${context.deploymentNumber}`;
  }

  async buildDockerImage(
    context: DeploymentExecutionContext,
    repoPath: string,
    imageTag: string,
    logWriter: DeploymentLogWriter,
  ) {
    const dockerfilePath = path.resolve(
      repoPath,
      context.project.dockerfilePath,
    );
    const buildContext = path.resolve(repoPath, context.project.buildContext);

    await this.commandRunner.run(
      'docker',
      ['build', '-f', dockerfilePath, '-t', imageTag, buildContext],
      {
        onStdoutLine: (line) => logWriter.stdout(line),
        onStderrLine: (line) => logWriter.stderr(line),
      },
    );
  }

  async deployContainer(
    context: DeploymentExecutionContext,
    imageTag: string,
    logWriter: DeploymentLogWriter,
  ) {
    const containerName = ensureRequired(
      context.project.containerName,
      'containerName',
    );
    const hostPort = ensureRequired(context.project.hostPort, 'hostPort');
    const backupName = `${containerName}-backup-${context.id.slice(-6)}`;
    const previousContainerId = await this.findContainerId(containerName);

    if (previousContainerId) {
      await logWriter.system(`Stopping existing container ${containerName}`);
      await this.commandRunner.run('docker', ['stop', containerName], {
        onStdoutLine: (line) => logWriter.stdout(line),
        onStderrLine: (line) => logWriter.stderr(line),
      });
      await this.commandRunner.run(
        'docker',
        ['rename', containerName, backupName],
        {
          onStdoutLine: (line) => logWriter.stdout(line),
          onStderrLine: (line) => logWriter.stderr(line),
        },
      );
    }

    try {
      const runResult = await this.commandRunner.run(
        'docker',
        [
          'run',
          '-d',
          '--name',
          containerName,
          '-p',
          `${hostPort}:${context.project.containerPort}`,
          imageTag,
        ],
        {
          onStdoutLine: (line) => logWriter.stdout(line),
          onStderrLine: (line) => logWriter.stderr(line),
        },
      );

      const containerId = runResult.stdout.trim().split(/\r?\n/).pop()?.trim();
      if (!containerId) {
        throw new Error(
          'Docker run succeeded but did not return a container id',
        );
      }

      if (previousContainerId) {
        await this.commandRunner.run('docker', ['rm', backupName], {
          onStdoutLine: (line) => logWriter.stdout(line),
          onStderrLine: (line) => logWriter.stderr(line),
        });
      }

      return containerId;
    } catch (error) {
      if (previousContainerId) {
        await logWriter.system(
          `Rolling back to previous container ${containerName}`,
        );
        await this.rollbackContainer(containerName, backupName, logWriter);
      }
      throw error;
    }
  }

  private async rollbackContainer(
    containerName: string,
    backupName: string,
    logWriter: DeploymentLogWriter,
  ) {
    const currentContainerId = await this.findContainerId(containerName);
    if (currentContainerId) {
      await this.runBestEffort(['rm', '-f', containerName], logWriter);
    }

    await this.runBestEffort(['rename', backupName, containerName], logWriter);
    await this.runBestEffort(['start', containerName], logWriter);
  }

  private async findContainerId(containerName: string) {
    try {
      const result = await this.commandRunner.run('docker', [
        'ps',
        '-aq',
        '--filter',
        `name=^${containerName}$`,
      ]);
      return result.stdout.trim() || null;
    } catch {
      return null;
    }
  }

  private async runBestEffort(
    args: string[],
    logWriter: DeploymentLogWriter,
  ) {
    try {
      await this.commandRunner.run('docker', args, {
        onStdoutLine: (line) => logWriter.stdout(line),
        onStderrLine: (line) => logWriter.stderr(line),
      });
    } catch (error) {
      await logWriter.error(
        `Best-effort command failed: docker ${args.join(' ')} (${getErrorMessage(error)})`,
      );
    }
  }
}

function ensureRequired<T>(value: T | null | undefined, fieldName: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `Project ${fieldName} is required for deployment execution`,
    );
  }

  return value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown deployment error';
}
