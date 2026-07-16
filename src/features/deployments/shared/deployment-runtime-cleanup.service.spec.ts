import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { ProjectRuntimeCleanupService } from '@/features/deployments/shared/deployment-runtime-cleanup.service';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

jest.mock('node:fs', () => ({
  promises: {
    rm: jest.fn(),
  },
}));

describe('ProjectRuntimeCleanupService', () => {
  const config = {
    get: jest.fn(),
  };
  const commandRunner = {
    run: jest.fn(),
  };
  let service: ProjectRuntimeCleanupService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(path.resolve('tmp', 'repos'));
    commandRunner.run.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });
    jest.mocked(fs.rm).mockResolvedValue(undefined);
    service = new ProjectRuntimeCleanupService(
      config as never,
      commandRunner as never,
    );
  });

  it('removes the running project container, project images, and workspace', async () => {
    commandRunner.run
      .mockResolvedValueOnce({
        stdout: 'container-1\n',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: 'mini-deploy/hello:deploy-1\nmini-deploy/hello:deploy-2\n',
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    await service.cleanupProjectResources(buildProject());

    expect(commandRunner.run).toHaveBeenNthCalledWith(1, 'docker', [
      'ps',
      '-aq',
      '--filter',
      'name=^hello$',
    ]);
    expect(commandRunner.run).toHaveBeenNthCalledWith(2, 'docker', [
      'rm',
      '-f',
      'hello',
    ]);
    expect(commandRunner.run).toHaveBeenNthCalledWith(3, 'docker', [
      'images',
      '--format',
      '{{.Repository}}:{{.Tag}}',
      '--filter',
      'reference=mini-deploy/hello:deploy-*',
    ]);
    expect(commandRunner.run).toHaveBeenNthCalledWith(4, 'docker', [
      'rmi',
      '-f',
      'mini-deploy/hello:deploy-1',
    ]);
    expect(commandRunner.run).toHaveBeenNthCalledWith(5, 'docker', [
      'rmi',
      '-f',
      'mini-deploy/hello:deploy-2',
    ]);
    expect(fs.rm).toHaveBeenCalledWith(
      path.resolve('tmp', 'repos', 'project-1-hello'),
      { recursive: true, force: true },
    );
  });

  it('skips container and image cleanup when they do not exist', async () => {
    commandRunner.run
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

    await service.cleanupProjectResources(buildProject());

    expect(commandRunner.run).toHaveBeenCalledTimes(2);
    expect(commandRunner.run).not.toHaveBeenCalledWith('docker', [
      'rm',
      '-f',
      'hello',
    ]);
    expect(commandRunner.run).not.toHaveBeenCalledWith('docker', [
      'rmi',
      '-f',
      expect.any(String),
    ]);
    expect(fs.rm).toHaveBeenCalled();
  });

  it('does not delete the database metadata path for unsupported runners', async () => {
    await expect(
      service.cleanupProjectResources({ ...buildProject(), runnerType: 'SSH' }),
    ).rejects.toMatchObject({
      response: { code: COMMON_ERROR_CODE.CONFLICT },
    });

    expect(commandRunner.run).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
  });

  it('blocks workspace deletion if the resolved path escapes repositories root', async () => {
    await expect(
      service.cleanupProjectResources({ ...buildProject(), id: '../outside' }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(fs.rm).not.toHaveBeenCalled();
  });
});

function buildProject() {
  return {
    id: 'project-1',
    slug: 'hello',
    runnerType: 'LOCAL',
    containerName: 'hello',
    imageName: 'mini-deploy/hello',
  };
}

