import type { EnvVars } from '@/config/env.validation';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  type GithubDeploymentAuthContext,
  GithubService,
} from '../github/github.service';
import {
  DeploymentCommandError,
  DeploymentCommandRunnerService,
} from './deployment-command-runner.service';
import { DeploymentLogWriter } from './deployment-log-writer';
import { DeploymentRepository } from './deployment.repository';
import type {
  DeploymentExecutionContext,
  DeploymentResolvedCommitInput,
} from './deployment.types';

@Injectable()
export class DeploymentSourceService {
  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly github: GithubService,
    private readonly deployments: DeploymentRepository,
    private readonly commandRunner: DeploymentCommandRunnerService,
  ) {}

  async prepareRepository(
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
    const githubAuth = await this.github.getDeploymentAuthContext(
      context.project.ownerId,
    );

    await logWriter.system(this.describeGithubAuthContext(githubAuth));
    await fs.mkdir(repositoriesRoot, { recursive: true });

    let checkoutTarget = context.commitSha ?? context.branch;

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
        githubAuth,
        logWriter,
      );
      checkoutTarget = context.commitSha ?? 'FETCH_HEAD';
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
        githubAuth,
        logWriter,
      );
    }

    await this.runGitCommand(
      ['-C', repoPath, 'checkout', '--force', checkoutTarget],
      githubAuth,
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
    githubAuth: GithubDeploymentAuthContext,
    logWriter: DeploymentLogWriter,
  ) {
    const authHeader = this.buildGithubGitAuthHeader(githubAuth.accessToken);

    try {
      await this.commandRunner.run(
        'git',
        [
          '-c',
          'credential.helper=',
          '-c',
          `http.extraHeader=${authHeader}`,
          ...args,
        ],
        {
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GCM_INTERACTIVE: 'never',
            GIT_ASKPASS: '',
            SSH_ASKPASS: '',
          },
          onStdoutLine: (line) => logWriter.stdout(line),
          onStderrLine: (line) => logWriter.stderr(line),
        },
      );
    } catch (error) {
      throw this.enrichGitAuthError(error, githubAuth);
    }
  }

  private buildGithubGitAuthHeader(githubToken: string) {
    const basicAuth = Buffer.from(`x-access-token:${githubToken}`).toString(
      'base64',
    );

    return `Authorization: Basic ${basicAuth}`;
  }

  private enrichGitAuthError(
    error: unknown,
    githubAuth: GithubDeploymentAuthContext,
  ) {
    if (!(error instanceof DeploymentCommandError)) {
      return error;
    }

    const combinedOutput =
      `${error.result.stderr}\n${error.result.stdout}`.toLowerCase();
    if (!this.isGitAuthenticationFailure(combinedOutput)) {
      return error;
    }

    const stderr = error.result.stderr.trimEnd();
    const diagnostics = this.buildGithubAuthFailureDiagnostics(githubAuth);

    return new DeploymentCommandError(error.message, {
      ...error.result,
      stderr: stderr ? `${stderr}\n${diagnostics}\n` : `${diagnostics}\n`,
    });
  }

  private isGitAuthenticationFailure(output: string) {
    return [
      'invalid credentials',
      'authentication failed',
      'terminal prompts disabled',
      'could not read username',
      'repository not found',
      'http basic: access denied',
    ].some((pattern) => output.includes(pattern));
  }

  private buildGithubAuthFailureDiagnostics(
    githubAuth: GithubDeploymentAuthContext,
  ) {
    const diagnostics = [
      'GitHub authentication diagnostics:',
      `requested OAuth scopes=${githubAuth.requestedScopeRaw ?? '(none configured)'}`,
      `granted token scopes=${githubAuth.grantedScopeRaw ?? '(none returned by OAuth)'}`,
      'interactive Git credential prompts were disabled for this deployment run.',
    ];

    if (!githubAuth.requestedScopes.includes('repo')) {
      diagnostics.push(
        "the app configuration is missing the 'repo' scope required for private repository clone.",
      );
    }

    if (
      githubAuth.requestedScopes.includes('repo') &&
      !githubAuth.grantedScopes.includes('repo')
    ) {
      diagnostics.push(
        "the stored token does not include the 'repo' scope. Reconnect GitHub and grant the requested scopes again.",
      );
    }

    diagnostics.push(
      'if the repository belongs to an organization with SSO enabled, authorize the token for that organization as well.',
    );

    return diagnostics.join(' ');
  }

  private describeGithubAuthContext(githubAuth: GithubDeploymentAuthContext) {
    return `GitHub OAuth scopes - requested: ${githubAuth.requestedScopeRaw ?? '(none configured)'}; granted: ${githubAuth.grantedScopeRaw ?? '(none returned by OAuth)'}`;
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
