import { COMMON_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import type { PrismaService } from '@/prisma/prisma.service';
import { ProjectRepository } from './project.repository';

describe('ProjectRepository', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const create = jest.fn();

  const prisma = {
    project: {
      findMany,
      count,
      create,
    },
  } as unknown as PrismaService;

  let repository: ProjectRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProjectRepository(prisma);
  });

  it('returns matching slugs for a base slug', async () => {
    findMany.mockResolvedValue([{ slug: 'demo' }, { slug: 'demo-2' }]);

    await expect(
      repository.findSlugsByBase('user-1', 'demo'),
    ).resolves.toEqual(['demo', 'demo-2']);
  });

  it('maps hostPort unique conflicts to a stable business code', async () => {
    create.mockRejectedValue(prismaUniqueError(['hostPort']));

    await expect(repository.create(createProjectData())).rejects.toMatchObject(
      new ConflictError(
        'Host port already exists',
        COMMON_ERROR_CODE.CONFLICT,
      ),
    );
  });

  it('maps owner and githubRepoId conflicts to a stable business code', async () => {
    create.mockRejectedValue(prismaUniqueError(['ownerId', 'githubRepoId']));

    await expect(repository.create(createProjectData())).rejects.toMatchObject(
      new ConflictError(
        'GitHub repository already exists for this user',
        COMMON_ERROR_CODE.CONFLICT,
      ),
    );
  });

  it('maps owner and slug conflicts to a stable business code', async () => {
    create.mockRejectedValue(prismaUniqueError(['ownerId', 'slug']));

    await expect(repository.create(createProjectData())).rejects.toMatchObject(
      new ConflictError(
        'Project slug already exists',
        COMMON_ERROR_CODE.CONFLICT,
      ),
    );
  });
});

function createProjectData() {
  return {
    ownerId: 'user-1',
    githubRepoId: '123',
    name: 'Demo',
    slug: 'demo',
    deployBranch: 'main',
    repoFullName: 'octocat/demo',
    repoOwner: 'octocat',
    repoName: 'demo',
    repoUrl: 'https://github.com/octocat/demo',
    githubDefaultBranch: 'main',
    autoDeploy: false,
  };
}

function prismaUniqueError(target: string[]) {
  return {
    code: 'P2002',
    meta: { target },
  };
}
