import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import type { ProjectRepository } from './project.repository';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  const findAll = jest.fn();
  const count = jest.fn();
  const findSlugsByBase = jest.fn();
  const create = jest.fn();

  const projects = {
    findAll,
    count,
    findSlugsByBase,
    create,
  } as unknown as ProjectRepository;

  let service: ProjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectService(projects);
  });

  it('creates a project with the next available slug for the owner', async () => {
    findSlugsByBase.mockResolvedValue(['my-app', 'my-app-2']);
    create.mockResolvedValue({ id: 'project-1', slug: 'my-app-3' });

    await expect(
      service.createProject('user-1', createProjectInput()),
    ).resolves.toEqual({ id: 'project-1', slug: 'my-app-3' });

    expect(findSlugsByBase).toHaveBeenCalledWith('user-1', 'my-app');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'user-1',
        slug: 'my-app-3',
        repoFullName: 'octocat/my-app',
        githubDefaultBranch: 'main',
      }),
    );
  });

  it('retries with a new slug when create hits a slug conflict', async () => {
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
      .mockResolvedValueOnce({ id: 'project-2', slug: 'my-app-3' });

    await expect(
      service.createProject('user-1', createProjectInput()),
    ).resolves.toEqual({ id: 'project-2', slug: 'my-app-3' });

    expect(create).toHaveBeenCalledTimes(2);
  });
});

function createProjectInput() {
  return {
    githubRepoId: '123',
    name: 'My App',
    deployBranch: 'main',
    repoFullName: 'octocat/my-app',
    repoOwner: 'octocat',
    repoName: 'my-app',
    repoUrl: 'https://github.com/octocat/my-app',
    githubDefaultBranch: 'main',
    rootDirectory: undefined,
    dockerfilePath: undefined,
    buildContext: undefined,
    containerPort: undefined,
    hostPort: null,
    autoDeploy: false,
  };
}
