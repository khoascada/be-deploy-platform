import { COMMON_ERROR_CODE, PROJECT_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { ProjectService } from './project.service';

describe('ProjectService.deleteProject', () => {
  const projects = {
    findById: jest.fn(),
    delete: jest.fn(),
    updateSettings: jest.fn(),
  };

  const github = {
    deleteRepositoryWebhook: jest.fn(),
  };

  const deployments = {
    findActiveByProjectId: jest.fn(),
  };

  const runtimeCleanup = {
    cleanupProjectResources: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectService(
      projects as never,
      github as never,
      deployments as never,
      runtimeCleanup as never,
    );
  });

  it('throws not found when the project does not exist', async () => {
    projects.findById.mockResolvedValue(null);

    await expect(service.deleteProject('user-1', 'project-1')).rejects.toMatchObject({
      response: {
        message: 'Project not found',
        code: COMMON_ERROR_CODE.NOT_FOUND,
      },
    });

    expect(deployments.findActiveByProjectId).not.toHaveBeenCalled();
    expect(runtimeCleanup.cleanupProjectResources).not.toHaveBeenCalled();
    expect(projects.delete).not.toHaveBeenCalled();
  });

  it('throws not found when the user does not own the project', async () => {
    projects.findById.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-2',
    });

    await expect(service.deleteProject('user-1', 'project-1')).rejects.toMatchObject({
      response: {
        message: 'Project not found',
        code: PROJECT_ERROR_CODE.PROJECT_NOT_FOUND,
      },
    });

    expect(deployments.findActiveByProjectId).not.toHaveBeenCalled();
    expect(runtimeCleanup.cleanupProjectResources).not.toHaveBeenCalled();
    expect(projects.delete).not.toHaveBeenCalled();
  });

  it('throws conflict when the project has an active deployment', async () => {
    projects.findById.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
      repoOwner: 'octocat',
      repoName: 'hello-world',
      webhookId: '123',
    });
    deployments.findActiveByProjectId.mockResolvedValue({
      id: 'deployment-1',
      status: 'QUEUED',
    });

    await expect(service.deleteProject('user-1', 'project-1')).rejects.toMatchObject({
      response: {
        code: PROJECT_ERROR_CODE.PROJECT_HAS_ACTIVE_DEPLOYMENT,
      },
    });

    expect(github.deleteRepositoryWebhook).not.toHaveBeenCalled();
    expect(runtimeCleanup.cleanupProjectResources).not.toHaveBeenCalled();
    expect(projects.delete).not.toHaveBeenCalled();
  });

  it('deletes the project after runtime cleanup when no webhook is configured', async () => {
    const project = buildProject({ webhookId: null });
    projects.findById.mockResolvedValue(project);
    deployments.findActiveByProjectId.mockResolvedValue(null);
    runtimeCleanup.cleanupProjectResources.mockResolvedValue(undefined);

    await expect(service.deleteProject('user-1', 'project-1')).resolves.toBeUndefined();

    expect(github.deleteRepositoryWebhook).not.toHaveBeenCalled();
    expect(runtimeCleanup.cleanupProjectResources).toHaveBeenCalledWith(project);
    expect(runtimeCleanup.cleanupProjectResources.mock.invocationCallOrder[0]).toBeLessThan(
      projects.delete.mock.invocationCallOrder[0],
    );
    expect(projects.delete).toHaveBeenCalledWith('project-1');
  });

  it('deletes the project after GitHub confirms webhook deletion and runtime cleanup succeeds', async () => {
    const project = buildProject({ webhookId: '123' });
    projects.findById.mockResolvedValue(project);
    deployments.findActiveByProjectId.mockResolvedValue(null);
    github.deleteRepositoryWebhook.mockResolvedValue({ deleted: true });
    runtimeCleanup.cleanupProjectResources.mockResolvedValue(undefined);

    await expect(service.deleteProject('user-1', 'project-1')).resolves.toBeUndefined();

    expect(github.deleteRepositoryWebhook).toHaveBeenCalledWith(
      'user-1',
      'octocat',
      'hello-world',
      '123',
    );
    expect(runtimeCleanup.cleanupProjectResources).toHaveBeenCalledWith(project);
    expect(github.deleteRepositoryWebhook.mock.invocationCallOrder[0]).toBeLessThan(
      runtimeCleanup.cleanupProjectResources.mock.invocationCallOrder[0],
    );
    expect(runtimeCleanup.cleanupProjectResources.mock.invocationCallOrder[0]).toBeLessThan(
      projects.delete.mock.invocationCallOrder[0],
    );
    expect(projects.delete).toHaveBeenCalledWith('project-1');
  });

  it('continues deleting the project when the GitHub webhook is already gone', async () => {
    const project = buildProject({ webhookId: '123' });
    projects.findById.mockResolvedValue(project);
    deployments.findActiveByProjectId.mockResolvedValue(null);
    github.deleteRepositoryWebhook.mockResolvedValue({ deleted: false });
    runtimeCleanup.cleanupProjectResources.mockResolvedValue(undefined);

    await expect(service.deleteProject('user-1', 'project-1')).resolves.toBeUndefined();

    expect(runtimeCleanup.cleanupProjectResources).toHaveBeenCalledWith(project);
    expect(projects.delete).toHaveBeenCalledWith('project-1');
  });

  it('stops before deleting the database record when GitHub webhook deletion fails', async () => {
    projects.findById.mockResolvedValue(buildProject({ webhookId: '123' }));
    deployments.findActiveByProjectId.mockResolvedValue(null);
    github.deleteRepositoryWebhook.mockRejectedValue(
      new ConflictError('upstream failed'),
    );

    await expect(service.deleteProject('user-1', 'project-1')).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(runtimeCleanup.cleanupProjectResources).not.toHaveBeenCalled();
    expect(projects.delete).not.toHaveBeenCalled();
  });

  it('stops before deleting the database record when runtime cleanup fails', async () => {
    projects.findById.mockResolvedValue(buildProject({ webhookId: null }));
    deployments.findActiveByProjectId.mockResolvedValue(null);
    runtimeCleanup.cleanupProjectResources.mockRejectedValue(
      new ConflictError('cleanup failed'),
    );

    await expect(service.deleteProject('user-1', 'project-1')).rejects.toBeInstanceOf(
      ConflictError,
    );

    expect(projects.delete).not.toHaveBeenCalled();
  });
});

describe('ProjectService.updateProject', () => {
  const projects = {
    findById: jest.fn(),
    updateSettings: jest.fn(),
  };
  const deployments = { findActiveByProjectId: jest.fn() };
  let service: ProjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectService(
      projects as never,
      {} as never,
      deployments as never,
      {} as never,
    );
  });

  it('updates settings and returns refreshed detail for the owner', async () => {
    const project = {
      id: 'project-1',
      ownerId: 'user-1',
      deployments: [],
      webhookEvents: [],
    };
    projects.findById
      .mockResolvedValueOnce(project)
      .mockResolvedValueOnce(project);
    deployments.findActiveByProjectId.mockResolvedValue(null);

    await service.updateProject('user-1', 'project-1', {
      autoDeploy: false,
    });

    expect(projects.updateSettings).toHaveBeenCalledWith('project-1', {
      autoDeploy: false,
    });
    expect(projects.findById).toHaveBeenCalledTimes(2);
  });

  it('returns not found when the project is missing or belongs to another user', async () => {
    projects.findById.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-2',
    });

    await expect(
      service.updateProject('user-1', 'project-1', { autoDeploy: false }),
    ).rejects.toMatchObject({
      response: { code: PROJECT_ERROR_CODE.PROJECT_NOT_FOUND },
    });
    expect(projects.updateSettings).not.toHaveBeenCalled();
  });

  it('rejects updates while a deployment is active', async () => {
    projects.findById.mockResolvedValue({
      id: 'project-1',
      ownerId: 'user-1',
    });
    deployments.findActiveByProjectId.mockResolvedValue({
      id: 'deployment-1',
      status: 'BUILDING',
    });

    await expect(
      service.updateProject('user-1', 'project-1', { autoDeploy: false }),
    ).rejects.toMatchObject({
      response: { code: PROJECT_ERROR_CODE.PROJECT_HAS_ACTIVE_DEPLOYMENT },
    });
    expect(projects.updateSettings).not.toHaveBeenCalled();
  });
});

function buildProject(overrides: Record<string, unknown>) {
  return {
    id: 'project-1',
    ownerId: 'user-1',
    repoOwner: 'octocat',
    repoName: 'hello-world',
    slug: 'hello-world',
    runnerType: 'LOCAL',
    containerName: 'hello-world',
    imageName: 'mini-deploy/hello-world',
    ...overrides,
  };
}
