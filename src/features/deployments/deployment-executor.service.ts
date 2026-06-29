import type { EnvVars } from '@/config/env.validation';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentStatus, LogLevel, LogStream } from '@prisma/client';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { GithubService } from '../github/github.service';
import {
  DeploymentCommandError,
  DeploymentCommandRunnerService,
} from './deployment-command-runner.service';
import { DeploymentRepository } from './deployment.repository';
import type {
  DeploymentExecutionContext,
  DeploymentFailureInput,
  DeploymentResolvedCommitInput,
} from './deployment.types';

@Injectable()
export class DeploymentExecutorService {
  private readonly logger = new Logger(DeploymentExecutorService.name);

  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly github: GithubService,
    private readonly deployments: DeploymentRepository,
    private readonly commandRunner: DeploymentCommandRunnerService,
  ) {}

  async execute(deploymentId: string) {
    const context = await this.deployments.claimQueuedDeployment(deploymentId);

    if (!context) {
      this.logger.warn(
        `Skipping deployment ${deploymentId} because it is no longer claimable`,
      );
      return;
    }

    const logWriter = new DeploymentLogWriter(this.deployments, context);

    try {
      await logWriter.system(
        `Starting deployment #${context.deploymentNumber} for project ${context.project.slug}`,
      );

      const repoPath = await this.prepareRepository(context, logWriter);
      const imageTag = this.buildImageTag(context);

      await this.deployments.updateStatus(
        context.id,
        DeploymentStatus.BUILDING,
      );
      await logWriter.system(`Building Docker image ${imageTag}`);
      await this.buildDockerImage(context, repoPath, imageTag, logWriter);

      await this.deployments.updateStatus(
        context.id,
        DeploymentStatus.DEPLOYING,
        {
          imageTag,
        },
      );
      await logWriter.system(
        `Deploying container ${context.project.containerName}`,
      );
      const containerId = await this.deployContainer(
        context,
        imageTag,
        logWriter,
      );

      await logWriter.system(
        `Deployment finished successfully with container ${containerId}`,
      );
      await logWriter.flush();
      await this.deployments.markSuccess(context.id, { imageTag, containerId });
    } catch (error) {
      const failure = toFailureInput(error);
      await logWriter.error(`Deployment failed: ${failure.errorMessage}`);
      await logWriter.flush();
      await this.deployments.markFailed(context.id, failure);
      throw error;
    }
  }

  private async prepareRepository(
    context: DeploymentExecutionContext,
    logWriter: DeploymentLogWriter,
  ) {
    const repositoriesRoot = this.config.get('REPOSITORIES_ROOT', {
      infer: true,
    });
    const repoPath = path.resolve(
      repositoriesRoot,
      `${context.project.id}-${context.project.slug}`,
    );
    const gitDir = path.join(repoPath, '.git');
    const githubToken = (await this.github.getAccessTokenForUser(
      context.project.ownerId,
    ));

    await fs.mkdir(repositoriesRoot, { recursive: true });

    if (await pathExists(gitDir)) {
      await logWriter.system('Fetching latest repository state');
      await this.commandRunner.run(
        'git',
        ['-C', repoPath, 'remote', 'set-url', 'origin', this.getRemoteUrl(context)],
        {
          onStdoutLine: (line) => logWriter.stdout(line),
          onStderrLine: (line) => logWriter.stderr(line),
        },
      );
      await this.runGitCommand(
        ['-C', repoPath, 'fetch', 'origin', context.branch, '--prune'],
        githubToken,
        logWriter,
      );
    } else {
      if (await pathExists(repoPath)) {
        await fs.rm(repoPath, { recursive: true, force: true });
      }

      await logWriter.system('Cloning repository workspace');
      await this.runGitCommand(
        [
          'clone',
          '--branch',
          context.branch,
          '--single-branch',
          this.getRemoteUrl(context),
          repoPath,
        ],
        githubToken,
        logWriter,
      );
    }

    const checkoutTarget = context.commitSha ?? 'FETCH_HEAD';
    await this.runGitCommand(
      ['-C', repoPath, 'checkout', '--force', checkoutTarget],
      githubToken,
      logWriter,
    );

    const revision = await this.resolveCommitMetadata(repoPath);
    await this.deployments.saveResolvedCommit(context.id, revision);
    await logWriter.system(`Checked out commit ${revision.commitSha}`);

    return repoPath;
  }

  private async resolveCommitMetadata(
    repoPath: string,
  ): Promise<DeploymentResolvedCommitInput> {
    const result = await this.commandRunner.run('git', [
      '-C',
      repoPath,
      'show',
      '-s',
      '--format=%H%n%s%n%an%n%ae',
      'HEAD',
    ]);
    const [commitSha = '', commitMessage = '', authorName = '', authorEmail = ''] =
      result.stdout.trim().split(/\r?\n/);

    return {
      commitSha,
      commitMessage: commitMessage || null,
      commitAuthorName: authorName || null,
      commitAuthorEmail: authorEmail || null,
    };
  }

  private async buildDockerImage(
    context: DeploymentExecutionContext,
    repoPath: string,
    imageTag: string,
    logWriter: DeploymentLogWriter,
  ) {
    const dockerfilePath = path.resolve(repoPath, context.project.dockerfilePath);
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

  private async deployContainer(
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
      await this.commandRunner.run('docker', ['rename', containerName, backupName], {
        onStdoutLine: (line) => logWriter.stdout(line),
        onStderrLine: (line) => logWriter.stderr(line),
      });
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
        throw new Error('Docker run succeeded but did not return a container id');
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

  private async runBestEffort(args: string[], logWriter: DeploymentLogWriter) {
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

  private async runGitCommand(
    args: string[],
    githubToken: string,
    logWriter: DeploymentLogWriter,
  ) {
    await this.commandRunner.run(
      'git',
      ['-c', `http.extraHeader=Authorization: Bearer ${githubToken}`, ...args],
      {
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
        onStdoutLine: (line) => logWriter.stdout(line),
        onStderrLine: (line) => logWriter.stderr(line),
      },
    );
  }

  private getRemoteUrl(context: DeploymentExecutionContext) {
    return `https://github.com/${context.project.repoFullName}.git`;
  }

  private buildImageTag(context: DeploymentExecutionContext) {
    const imageName = ensureRequired(context.project.imageName, 'imageName');
    return `${imageName}:deploy-${context.deploymentNumber}`;
  }
}

class DeploymentLogWriter {
  private readonly logger = new Logger(DeploymentLogWriter.name);
  private nextSeq = 1;
  private queue = Promise.resolve();

  constructor(
    private readonly deployments: DeploymentRepository,
    private readonly context: DeploymentExecutionContext,
  ) {}

  system(message: string) {
    return this.append(LogStream.SYSTEM, LogLevel.INFO, message);
  }

  stdout(message: string) {
    return this.append(LogStream.STDOUT, LogLevel.INFO, message);
  }

  stderr(message: string) {
    return this.append(LogStream.STDERR, LogLevel.ERROR, message);
  }

  error(message: string) {
    return this.append(LogStream.SYSTEM, LogLevel.ERROR, message);
  }

  async flush() {
    await this.queue;
  }

  private append(stream: LogStream, level: LogLevel, message: string) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return Promise.resolve();
    }

    const seq = this.nextSeq;
    this.nextSeq += 1;

    this.queue = this.queue
      .then(async () => {
        await this.deployments.appendLog({
          deploymentId: this.context.id,
          projectId: this.context.projectId,
          seq,
          level,
          stream,
          message: trimmedMessage,
        });
      })
      .catch((error: unknown) => {
        this.logger.error(getErrorMessage(error));
      });

    return this.queue;
  }
}

function ensureRequired<T>(
  value: T | null | undefined,
  fieldName: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(`Project ${fieldName} is required for deployment execution`);
  }

  return value;
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toFailureInput(error: unknown): DeploymentFailureInput {
  if (error instanceof DeploymentCommandError) {
    const stderr = error.result.stderr.trim();
    const stdout = error.result.stdout.trim();

    return {
      errorMessage: stderr || stdout || error.message,
    };
  }

  return {
    errorMessage: getErrorMessage(error),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown deployment error';
}





