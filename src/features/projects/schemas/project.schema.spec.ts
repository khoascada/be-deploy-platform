import { createProjectSchema } from './project.schema';

describe('createProjectSchema', () => {
  it('normalizes optional fields and ports the same way as the frontend', () => {
    expect(
      createProjectSchema.parse({
        githubRepoId: '123',
        name: 'My App',
        deployBranch: 'main',

        rootDirectory: '   ',
        dockerfilePath: '',
        buildContext: ' apps/web ',
        containerPort: '3000',
        hostPort: '',
      }),
    ).toEqual({
      githubRepoId: '123',
      name: 'My App',
      deployBranch: 'main',

      rootDirectory: undefined,
      dockerfilePath: undefined,
      buildContext: 'apps/web',
      containerPort: 3000,
      hostPort: null,
      autoDeploy: false,
    });
  });

  it('allows omitting optional fields so Prisma defaults can apply', () => {
    expect(
      createProjectSchema.parse({
        githubRepoId: '123',
        name: 'My App',
        deployBranch: 'main',

        hostPort: null,
      }),
    ).toEqual({
      githubRepoId: '123',
      name: 'My App',
      deployBranch: 'main',

      hostPort: null,
      autoDeploy: false,
    });
  });

  it('rejects invalid port values', () => {
    expect(() =>
      createProjectSchema.parse({
        githubRepoId: '123',
        name: 'My App',
        deployBranch: 'main',

        hostPort: null,
        containerPort: 'abc',
      }),
    ).toThrow('Invalid port number');
  });
});
