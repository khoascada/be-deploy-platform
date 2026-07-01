import type { EnvVars } from '@/config/env.validation';
import type { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  GithubDeploymentAuthContext,
  GithubService,
} from '../github/github.service';
import {
  DeploymentCommandError,
  type DeploymentCommandRunnerService,
} from './deployment-command-runner.service';
import type { DeploymentRepository } from './deployment.repository';
import { DeploymentSourceService } from './deployment-source.service';
import type { DeploymentExecutionContext } from './deployment.types';

function makeContext(
  overrides: Partial<DeploymentExecutionContext> = {},
): DeploymentExecutionContext {
  const now = new Date('2026-07-01T10:00:00.000Z');

  return {
    id: 'deployment-123',
    projectId: 'project-123',
    deploymentNumber: 1,
    trigger: 'MANUAL',
    status: 'QUEUED',
    branch: 'main',
    commitSha: null,
    commitMessage: null,
    commitAuthorName: null,
    commitAuthorEmail: null,
    imageTag: null,
    containerId: null,
    errorMessage: null,
    queuedAt: now,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    project: {
      id: 'project-123',
      ownerId: 'user-123',
      slug: 'portfolio',
      repoFullName: 'khoascada/npdkhoa-portfolio',
      deployBranch: 'main',
      rootDirectory: '.',
      dockerfilePath: 'Dockerfile',
      buildContext: '.',
      runnerType: 'LOCAL',
      containerPort: 3000,
      hostPort: 8080,
      containerName: 'portfolio-app',
      imageName: 'deploy-platform/portfolio',
      status: 'ACTIVE',
    },
    ...overrides,
  };
}

function makeGithubAuthContext(
  overrides: Partial<GithubDeploymentAuthContext> = {},
): GithubDeploymentAuthContext {
  return {
    accessToken: 'github-token-123',
    grantedScopes: ['read:user', 'repo'],
    grantedScopeRaw: 'read:user repo',
    requestedScopes: ['read:user', 'repo'],
    requestedScopeRaw: 'read:user repo',
    ...overrides,
  };
}

describe('DeploymentSourceService', () => {
  let repositoriesRoot: string;

  beforeEach(async () => {
    repositoriesRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'deployment-source-service-'),
    );
  });

  afterEach(async () => {
    await fs.rm(repositoriesRoot, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('checks out the branch name after a fresh clone when commitSha is absent', async () => {
    type RunCommand = DeploymentCommandRunnerService['run'];

    const github = {
      getDeploymentAuthContext: jest
        .fn()
        .mockResolvedValue(makeGithubAuthContext()),
    } satisfies Pick<GithubService, 'getDeploymentAuthContext'>;
    const deployments = {
      saveResolvedCommit: jest.fn().mockResolvedValue(undefined),
    } satisfies Pick<DeploymentRepository, 'saveResolvedCommit'>;
    const runMock = jest.fn<ReturnType<RunCommand>, Parameters<RunCommand>>();
    runMock
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: 'commit-sha\nCommit message\nOctocat\noctocat@example.com\n',
        stderr: '',
        exitCode: 0,
      });
    const commandRunner = {
      run: runMock,
    } satisfies Pick<DeploymentCommandRunnerService, 'run'>;
    const config = {
      get: jest.fn().mockReturnValue(repositoriesRoot),
    } satisfies Pick<ConfigService<EnvVars, true>, 'get'>;

    const service = new DeploymentSourceService(
      config as unknown as ConfigService<EnvVars, true>,
      github as unknown as GithubService,
      deployments as unknown as DeploymentRepository,
      commandRunner,
    );

    const logWriter = {
      system: jest.fn().mockResolvedValue(undefined),
      stdout: jest.fn().mockResolvedValue(undefined),
      stderr: jest.fn().mockResolvedValue(undefined),
    };

    await service.prepareRepository(makeContext(), logWriter as never);

    expect(runMock.mock.calls[0]?.[1]).toEqual([
      '-c',
      'credential.helper=',
      '-c',
      'http.extraHeader=Authorization: Basic eC1hY2Nlc3MtdG9rZW46Z2l0aHViLXRva2VuLTEyMw==',
      'clone',
      '--branch',
      'main',
      '--single-branch',
      'https://github.com/khoascada/npdkhoa-portfolio.git',
      path.resolve(repositoriesRoot, 'project-123-portfolio'),
    ]);
    expect(runMock.mock.calls[1]?.[1]).toEqual([
      '-c',
      'credential.helper=',
      '-c',
      'http.extraHeader=Authorization: Basic eC1hY2Nlc3MtdG9rZW46Z2l0aHViLXRva2VuLTEyMw==',
      '-C',
      path.resolve(repositoriesRoot, 'project-123-portfolio'),
      'checkout',
      '--force',
      'main',
    ]);
    expect(logWriter.system).toHaveBeenCalledWith(
      'GitHub OAuth scopes - requested: read:user repo; granted: read:user repo',
    );
  });

  it('checks out FETCH_HEAD after fetch when repo already exists and commitSha is absent', async () => {
    type RunCommand = DeploymentCommandRunnerService['run'];

    const repoPath = path.resolve(repositoriesRoot, 'project-123-portfolio');
    await fs.mkdir(path.join(repoPath, '.git'), { recursive: true });

    const github = {
      getDeploymentAuthContext: jest
        .fn()
        .mockResolvedValue(makeGithubAuthContext()),
    } satisfies Pick<GithubService, 'getDeploymentAuthContext'>;
    const deployments = {
      saveResolvedCommit: jest.fn().mockResolvedValue(undefined),
    } satisfies Pick<DeploymentRepository, 'saveResolvedCommit'>;
    const runMock = jest.fn<ReturnType<RunCommand>, Parameters<RunCommand>>();
    runMock
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: 'commit-sha\nCommit message\nOctocat\noctocat@example.com\n',
        stderr: '',
        exitCode: 0,
      });
    const commandRunner = {
      run: runMock,
    } satisfies Pick<DeploymentCommandRunnerService, 'run'>;
    const config = {
      get: jest.fn().mockReturnValue(repositoriesRoot),
    } satisfies Pick<ConfigService<EnvVars, true>, 'get'>;

    const service = new DeploymentSourceService(
      config as unknown as ConfigService<EnvVars, true>,
      github as unknown as GithubService,
      deployments as unknown as DeploymentRepository,
      commandRunner,
    );

    await service.prepareRepository(
      makeContext(),
      {
        system: jest.fn().mockResolvedValue(undefined),
        stdout: jest.fn().mockResolvedValue(undefined),
        stderr: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    expect(runMock.mock.calls[2]?.[1]).toEqual([
      '-c',
      'credential.helper=',
      '-c',
      'http.extraHeader=Authorization: Basic eC1hY2Nlc3MtdG9rZW46Z2l0aHViLXRva2VuLTEyMw==',
      '-C',
      repoPath,
      'checkout',
      '--force',
      'FETCH_HEAD',
    ]);
  });

  it('appends safe scope diagnostics when git authentication fails', async () => {
    type RunCommand = DeploymentCommandRunnerService['run'];

    const github = {
      getDeploymentAuthContext: jest.fn().mockResolvedValue(
        makeGithubAuthContext({
          grantedScopes: ['read:user'],
          grantedScopeRaw: 'read:user',
        }),
      ),
    } satisfies Pick<GithubService, 'getDeploymentAuthContext'>;
    const runMock = jest.fn<ReturnType<RunCommand>, Parameters<RunCommand>>();
    runMock.mockRejectedValue(
      new DeploymentCommandError('git exited with code 128', {
        stdout: '',
        stderr:
          "remote: invalid credentials\nfatal: Authentication failed for 'https://github.com/khoascada/npdkhoa-portfolio.git/'\n",
        exitCode: 128,
      }),
    );
    const config = {
      get: jest.fn().mockReturnValue(repositoriesRoot),
    } satisfies Pick<ConfigService<EnvVars, true>, 'get'>;
    const deployments = {
      saveResolvedCommit: jest.fn(),
    } satisfies Pick<DeploymentRepository, 'saveResolvedCommit'>;
    const commandRunner = {
      run: runMock,
    } satisfies Pick<DeploymentCommandRunnerService, 'run'>;

    const service = new DeploymentSourceService(
      config as unknown as ConfigService<EnvVars, true>,
      github as unknown as GithubService,
      deployments as unknown as DeploymentRepository,
      commandRunner,
    );

    let failure: unknown;

    try {
      await service.prepareRepository(
        makeContext(),
        {
          system: jest.fn().mockResolvedValue(undefined),
          stdout: jest.fn().mockResolvedValue(undefined),
          stderr: jest.fn().mockResolvedValue(undefined),
        } as never,
      );
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(DeploymentCommandError);

    if (!(failure instanceof DeploymentCommandError)) {
      throw new Error('Expected DeploymentCommandError');
    }

    expect(failure.result.stderr).toContain(
      "stored token does not include the 'repo' scope",
    );
    expect(failure.result.stderr).toContain(
      'interactive Git credential prompts were disabled',
    );
  });
});
