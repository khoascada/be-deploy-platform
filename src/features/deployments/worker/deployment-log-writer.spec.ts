import { Logger } from '@nestjs/common';
import { LogLevel, LogStream } from '@prisma/client';
import { DeploymentLogWriter } from '@/features/deployments/worker/deployment-log-writer';
import type { DeploymentExecutionContext } from '@/features/deployments/shared/deployment.types';

function makeContext(): DeploymentExecutionContext {
  const now = new Date('2026-07-01T10:00:00.000Z');

  return {
    id: 'deployment-123',
    projectId: 'project-123',
    deploymentNumber: 7,
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
  };
}

describe('DeploymentLogWriter', () => {
  const appendLog = jest.fn();
  const deployments = { appendLog };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes stdout logs to terminal and persists them to the repository', async () => {
    const loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    appendLog.mockResolvedValue(undefined);

    const writer = new DeploymentLogWriter(
      deployments as never,
      makeContext(),
    );

    await writer.stdout('cloning repository');

    expect(loggerLogSpy).toHaveBeenCalledWith(
      '[deploy #7 portfolio] [STDOUT] cloning repository',
    );
    expect(appendLog).toHaveBeenCalledWith({
      deploymentId: 'deployment-123',
      projectId: 'project-123',
      seq: 1,
      level: LogLevel.INFO,
      stream: LogStream.STDOUT,
      message: 'cloning repository',
    });
  });

  it('writes stderr logs to terminal as info while preserving the stderr stream', async () => {
    const loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    appendLog.mockResolvedValue(undefined);

    const writer = new DeploymentLogWriter(
      deployments as never,
      makeContext(),
    );

    await writer.stderr('#34 DONE 1.6s');

    expect(loggerLogSpy).toHaveBeenCalledWith(
      '[deploy #7 portfolio] [STDERR] #34 DONE 1.6s',
    );
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.INFO,
        stream: LogStream.STDERR,
        message: '#34 DONE 1.6s',
      }),
    );
  });

  it('writes explicit deployment errors to terminal via logger.error', async () => {
    const loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    appendLog.mockResolvedValue(undefined);

    const writer = new DeploymentLogWriter(
      deployments as never,
      makeContext(),
    );

    await writer.error('Deployment failed: authentication failed');

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      '[deploy #7 portfolio] [SYSTEM] Deployment failed: authentication failed',
    );
    expect(appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.ERROR,
        stream: LogStream.SYSTEM,
        message: 'Deployment failed: authentication failed',
      }),
    );
  });
});
