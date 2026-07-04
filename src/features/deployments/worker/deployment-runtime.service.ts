import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  DeploymentExecutionContext,
  ResolvedEnvVar,
} from '@/features/deployments/shared/deployment.types';
import { DeploymentCommandRunnerService } from '@/features/deployments/worker/deployment-command-runner.service';
import { DeploymentLogWriter } from '@/features/deployments/worker/deployment-log-writer';
import { Injectable } from '@nestjs/common';

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
    buildEnvVars: ResolvedEnvVar[],
    logWriter: DeploymentLogWriter,
  ) {
    const dockerfilePath = path.resolve(
      repoPath,
      context.project.dockerfilePath,
    );
    const buildContext = path.resolve(repoPath, context.project.buildContext);
    // Gắn build args vào lệnh docker build để Dockerfile có thể đọc qua ARG.
    const buildArgs = buildEnvVars.flatMap((envVar) => [
      '--build-arg',
      `${envVar.key}=${envVar.value}`,
    ]);

    await this.commandRunner.run(
      'docker',
      ['build', '-f', dockerfilePath, '-t', imageTag, ...buildArgs, buildContext],
      {
        onStdoutLine: (line) => logWriter.stdout(line),
        onStderrLine: (line) => logWriter.stderr(line),
      },
    );
  }

  async deployContainer(
    context: DeploymentExecutionContext,
    imageTag: string,
    runtimeEnvVars: ResolvedEnvVar[],
    logWriter: DeploymentLogWriter,
  ) {
    const containerName = ensureRequired(
      context.project.containerName,
      'containerName',
    );
    const hostPort = ensureRequired(context.project.hostPort, 'hostPort');
    const backupName = `${containerName}-backup-${context.id.slice(-6)}`;
    const previousContainerId = await this.findContainerId(containerName);
    // Tạo env file tạm cho docker run nếu project có runtime env.
    const runtimeEnvFilePath = await this.createRuntimeEnvFile(
      context,
      runtimeEnvVars,
    );

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
      // Chỉ append --env-file khi runtime env file thực sự tồn tại.
      const runtimeArgs = runtimeEnvFilePath
        ? ['--env-file', runtimeEnvFilePath]
        : [];
      const runResult = await this.commandRunner.run(
        'docker',
        [
          'run',
          '-d',
          '--name',
          containerName,
          '-p',
          `${hostPort}:${context.project.containerPort}`,
          ...runtimeArgs,
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
    } finally {
      // Luôn dọn file env tạm để không giữ secret lại trên disk.
      await this.cleanupRuntimeEnvFile(runtimeEnvFilePath);
    }
  }

  // Tạo file env tạm cho docker run để tránh lộ secret trên command line.
  private async createRuntimeEnvFile(
    context: DeploymentExecutionContext,
    runtimeEnvVars: ResolvedEnvVar[],
  ) {
    if (runtimeEnvVars.length === 0) {
      return null;
    }

    const tempDir = path.join(os.tmpdir(), 'deploy-platform', context.id);
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, 'runtime.env');
    const content = runtimeEnvVars
      .map((envVar) => `${envVar.key}=${serializeEnvValue(envVar.value)}`)
      .join('\n');

    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  }

  // Xóa file env tạm sau khi docker run xong hoặc bị lỗi.
  private async cleanupRuntimeEnvFile(filePath: string | null) {
    if (!filePath) {
      return;
    }

    try {
      await fs.rm(path.dirname(filePath), { recursive: true, force: true });
    } catch {
      // Bỏ qua lỗi cleanup vì không nên làm fail deployment result.
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

// Giữ nguyên env value để docker đọc trực tiếp từ env file.
function serializeEnvValue(value: string) {
  return value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown deployment error';
}

