import type { EnvVars } from '@/config/env.validation';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { GithubService } from '../github/github.service';
import { DeploymentCommandRunnerService } from './deployment-command-runner.service';
import { DeploymentLogWriter } from './deployment-log-writer';
import { DeploymentRepository } from './deployment.repository';
import type {
  DeploymentExecutionContext,
  DeploymentResolvedCommitInput,
} from './deployment.types';

// Class xử lý git
@Injectable()
export class DeploymentSourceService {
  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly github: GithubService,
    private readonly deployments: DeploymentRepository,
    private readonly commandRunner: DeploymentCommandRunnerService,
  ) {}

  //
  async prepareRepository(
    context: DeploymentExecutionContext,
    logWriter: DeploymentLogWriter,
  ) {
    const repositoriesRoot = this.config.get('REPOSITORIES_ROOT', {
      infer: true,
    });
    // tạo repoPath
    const repoPath = path.resolve(
      repositoriesRoot,
      `${context.project.id}-${context.project.slug}`,
    );
    const gitDir = path.join(repoPath, '.git');
    const githubToken = await this.github.getAccessTokenForUser(
      context.project.ownerId,
    );
    console.log("🚀 ~ DeploymentSourceService ~ prepareRepository ~ githubToken:", githubToken)

    await fs.mkdir(repositoriesRoot, { recursive: true });

    // nếu repo đã tồn tại (check gitDir) -> fetch
    if (await pathExists(gitDir)) {
      await logWriter.system('Fetching latest repository state');
      await this.commandRunner.run(
        'git',
        [
          '-C',
          repoPath,
          'remote',
          'set-url',
          'origin',
          this.getRemoteUrl(context),
        ],
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
      // nếu repo chưa tồn tại -> clone
      if (await pathExists(repoPath)) {
        await fs.rm(repoPath, { recursive: true, force: true });
      }

      await logWriter.system('Cloning repository workspace');
      // checkout về commit cần deploy
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

    // info của commit mà repo vừa checkout
    const revision = await this.resolveCommitMetadata(repoPath);
    // update DB commit -> deployment
    await this.deployments.saveResolvedCommit(context.id, revision);
    // log
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
    const [
      commitSha = '',
      commitMessage = '',
      authorName = '',
      authorEmail = '',
    ] = result.stdout.trim().split(/\r?\n/);

    return {
      commitSha,
      commitMessage: commitMessage || null,
      commitAuthorName: authorName || null,
      commitAuthorEmail: authorEmail || null,
    };
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
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
