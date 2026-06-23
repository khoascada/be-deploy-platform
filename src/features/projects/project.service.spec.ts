import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import type { GithubService } from '../github/github.service';
import type { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  const findAll = jest.fn();
  const count = jest.fn();
  const findSlugsByBase = jest.fn();
  const create = jest.fn();
  const updateWebhookConfig = jest.fn();

  const projects = {
    findAll,
    count,
    findSlugsByBase,
    create,
    updateWebhookConfig,
  } as unknown as ProjectRepository;

  const resolveRepositoryById = jest.fn();
  const createRepositoryWebhook = jest.fn();

  const github = {
    resolveRepositoryById,
    createRepositoryWebhook,
  } as unknown as GithubService;

  let service: ProjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectService(projects, github);
  });

  it('maps webhook provisioning state and latest deploy in list responses', async () => {
    findAll.mockResolvedValue([
      {
        id: 'project-1',
        name: 'My App',
        repoFullName: 'octocat/my-app',
        deployBranch: 'main',
        repoUrl: 'https://github.com/octocat/my-app',
        webhookId: null,
        _count: { deployments: 0 },
        deployments: [],
      },
      {
        id: 'project-2',
        name: 'Next App',
        repoFullName: 'octocat/next-app',
        deployBranch: 'main',
        repoUrl: 'https://github.com/octocat/next-app',
        webhookId: '123',
        _count: { deployments: 2 },
        deployments: [
          {
            id: 'deploy-2',
            status: 'SUCCESS',
            commitSha: 'abcdef1234567890',
            commitMessage: 'Fix deploy',
            createdAt: new Date('2026-06-23T10:00:00.000Z'),
            finishedAt: new Date('2026-06-23T10:05:00.000Z'),
            trigger: 'GITHUB_PUSH',
          },
        ],
      },
    ]);
    count.mockResolvedValue(2);

    await expect(service.findAll({ page: 1, limit: 10 })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'project-1',
          isWebhookProvisioned: false,
          deployCount: 0,
          latestDeploy: null,
        }),
        expect.objectContaining({
          id: 'project-2',
          isWebhookProvisioned: true,
          deployCount: 2,
          latestDeploy: expect.objectContaining({
            id: 'deploy-2',
            status: 'SUCCESS',
            commitSha: 'abcdef1234567890',
            commitMessage: 'Fix deploy',
            createdAt: '2026-06-23T10:00:00.000Z',
            finishedAt: '2026-06-23T10:05:00.000Z',
            trigger: 'webhook',
          }),
        }),
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    });
  });

  it('creates a project with repo metadata and provisions a webhook', async () => {
    resolveRepositoryById.mockResolvedValue(githubRepo());
    findSlugsByBase.mockResolvedValue(['my-app', 'my-app-2']);
    create.mockResolvedValue({
      id: 'project-1',
      slug: 'my-app-3',
      webhookId: null,
      webhookSecretEncrypted: null,
    });
    createRepositoryWebhook.mockResolvedValue({
      webhookId: '456',
      webhookSecretEncrypted: 'encrypted-webhook-secret',
    });
    updateWebhookConfig.mockResolvedValue({
      id: 'project-1',
      slug: 'my-app-3',
      webhookId: '456',
      webhookSecretEncrypted: 'encrypted-webhook-secret',
    });

    await expect(service.createProject('user-1', createProjectInput())).resolves.toEqual(
      {
        id: 'project-1',
        slug: 'my-app-3',
        webhookId: '456',
        isWebhookProvisioned: true,
      },
    );

    expect(resolveRepositoryById).toHaveBeenCalledWith('user-1', '123');
    expect(findSlugsByBase).toHaveBeenCalledWith('user-1', 'my-app');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'user-1',
        githubRepoId: '123',
        slug: 'my-app-3',
        repoFullName: 'octocat/my-app',
        repoOwner: 'octocat',
        repoName: 'my-app',
        repoUrl: 'https://github.com/octocat/my-app',
        githubDefaultBranch: 'main',
        webhookId: null,
        webhookSecretEncrypted: null,
      }),
    );
    expect(createRepositoryWebhook).toHaveBeenCalledWith(
      'user-1',
      'octocat',
      'my-app',
    );
    expect(updateWebhookConfig).toHaveBeenCalledWith(
      'project-1',
      '456',
      'encrypted-webhook-secret',
    );
  });

  it('keeps the project pending when webhook creation fails', async () => {
    resolveRepositoryById.mockResolvedValue(githubRepo());
    findSlugsByBase.mockResolvedValue([]);
    create.mockResolvedValue({
      id: 'project-1',
      slug: 'my-app',
      webhookId: null,
      webhookSecretEncrypted: null,
    });
    createRepositoryWebhook.mockRejectedValue(new Error('GitHub down'));

    await expect(service.createProject('user-1', createProjectInput())).resolves.toEqual(
      {
        id: 'project-1',
        slug: 'my-app',
        webhookId: null,
        isWebhookProvisioned: false,
      },
    );

    expect(updateWebhookConfig).not.toHaveBeenCalled();
  });

  it('retries with a new slug when create hits a slug conflict', async () => {
    resolveRepositoryById.mockResolvedValue(githubRepo());
    findSlugsByBase
      .mockResolvedValueOnce(['my-app'])
      .mockResolvedValueOnce(['my-app', 'my-app-2']);
    create
      .mockRejectedValueOnce(
        new ConflictError(
          'Project slug already exists',
          COMMON_ERROR_CODE.CONFLICT,
        ),
      )
      .mockResolvedValueOnce({
        id: 'project-2',
        slug: 'my-app-3',
        webhookId: null,
        webhookSecretEncrypted: null,
      });
    createRepositoryWebhook.mockResolvedValue({
      webhookId: '789',
      webhookSecretEncrypted: 'encrypted-webhook-secret-2',
    });
    updateWebhookConfig.mockResolvedValue({
      id: 'project-2',
      slug: 'my-app-3',
      webhookId: '789',
      webhookSecretEncrypted: 'encrypted-webhook-secret-2',
    });

    await expect(service.createProject('user-1', createProjectInput())).resolves.toEqual(
      {
        id: 'project-2',
        slug: 'my-app-3',
        webhookId: '789',
        isWebhookProvisioned: true,
      },
    );

    expect(create).toHaveBeenCalledTimes(2);
    expect(createRepositoryWebhook).toHaveBeenCalledTimes(1);
  });

  it('does not create a project when the repository cannot be resolved', async () => {
    resolveRepositoryById.mockRejectedValue(new Error('not found'));

    await expect(service.createProject('user-1', createProjectInput())).rejects.toThrow(
      'not found',
    );

    expect(create).not.toHaveBeenCalled();
    expect(createRepositoryWebhook).not.toHaveBeenCalled();
  });
});

function createProjectInput() {
  return {
    githubRepoId: '123',
    name: 'My App',
    deployBranch: 'main',
    rootDirectory: undefined,
    dockerfilePath: undefined,
    buildContext: undefined,
    containerPort: undefined,
    hostPort: null,
    autoDeploy: false,
  };
}

function githubRepo() {
  return {
    id: '123',
    name: 'my-app',
    fullName: 'octocat/my-app',
    owner: {
      login: 'octocat',
      avatarUrl: null,
    },
    url: 'https://github.com/octocat/my-app',
    defaultBranch: 'main',
    private: false,
  };
}
