import {
  COMMON_ERROR_CODE,
  DEPLOYMENT_ERROR_CODE,
  PROJECT_ERROR_CODE,
} from '@/common/constants';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@/common/exceptions/app.exceptions';
import type { Project } from '@prisma/client';
import { DeploymentService } from './deployment.service';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-123',
    ownerId: 'user-123',
    name: 'My App',
    slug: 'my-app',
    repoFullName: 'octocat/my-app',
    repoOwner: 'octocat',
    repoName: 'my-app',
    repoUrl: 'https://github.com/octocat/my-app',
    githubRepoId: 'repo-123',
    githubDefaultBranch: 'main',
    deployBranch: 'main',
    rootDirectory: '.',
    dockerfilePath: 'Dockerfile',
    buildContext: '.',
    runnerType: 'LOCAL',
    sshHost: null,
    sshPort: 22,
    sshUser: null,
    sshKeyEncrypted: null,
    containerPort: 3000,
    hostPort: 8080,
    containerName: 'my-app',
    imageName: 'mini-deploy/my-app',
    autoDeploy: true,
    webhookId: null,
    webhookSecretEncrypted: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-06-29T10:00:00.000Z'),
    updatedAt: new Date('2026-06-29T10:00:00.000Z'),
    ...overrides,
  };
}

describe('DeploymentService', () => {
  const projects = {
    findById: jest.fn(),
  };

  const deployments = {
    createManualDeployment: jest.fn(),
    markEnqueueFailed: jest.fn(),
  };

  const deploymentQueue = {
    enqueue: jest.fn(),
  };

  const service = new DeploymentService(
    projects as never,
    deployments as never,
    deploymentQueue as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a manual deployment when the project is deployable', async () => {
    const project = makeProject();
    const deployment = {
      id: 'deployment-1',
      projectId: project.id,
      deploymentNumber: 1,
      trigger: 'MANUAL',
      status: 'QUEUED',
      branch: 'main',
      queuedAt: new Date('2026-06-29T10:00:00.000Z'),
      createdAt: new Date('2026-06-29T10:00:00.000Z'),
    };

    projects.findById.mockResolvedValue(project);
    deployments.createManualDeployment.mockResolvedValue(deployment);
    deploymentQueue.enqueue.mockResolvedValue(undefined);

    await expect(
      service.createManualDeployment('user-123', 'project-123'),
    ).resolves.toEqual({
      id: 'deployment-1',
      projectId: 'project-123',
      deploymentNumber: 1,
      trigger: 'MANUAL',
      status: 'QUEUED',
      branch: 'main',
      queuedAt: '2026-06-29T10:00:00.000Z',
      createdAt: '2026-06-29T10:00:00.000Z',
    });

    expect(deployments.createManualDeployment).toHaveBeenCalledWith(
      'project-123',
      'main',
    );
    expect(deploymentQueue.enqueue).toHaveBeenCalledWith('deployment-1');
  });

  it('throws not found when the project does not exist', async () => {
    projects.findById.mockResolvedValue(null);

    await expect(
      service.createManualDeployment('user-123', 'missing-project'),
    ).rejects.toMatchObject(
      new NotFoundError('Project not found', COMMON_ERROR_CODE.NOT_FOUND),
    );
  });

  it('throws not found when the authenticated user does not own the project', async () => {
    projects.findById.mockResolvedValue(makeProject({ ownerId: 'user-999' }));

    await expect(
      service.createManualDeployment('user-123', 'project-123'),
    ).rejects.toMatchObject(
      new NotFoundError(
        'Not found or not accessible',
        PROJECT_ERROR_CODE.NOT_ACCESS_TO_PROJECT,
      ),
    );
  });

  it('throws a deployment error when the project is not active', async () => {
    projects.findById.mockResolvedValue(makeProject({ status: 'PAUSED' }));

    await expect(
      service.createManualDeployment('user-123', 'project-123'),
    ).rejects.toMatchObject(
      new ValidationError(
        'Project must be ACTIVE before deploying',
        undefined,
        DEPLOYMENT_ERROR_CODE.PROJECT_NOT_ACTIVE,
      ),
    );
  });

  it('throws a deployment error when the project runner type is not LOCAL', async () => {
    projects.findById.mockResolvedValue(makeProject({ runnerType: 'SSH' }));

    await expect(
      service.createManualDeployment('user-123', 'project-123'),
    ).rejects.toMatchObject(
      new ValidationError(
        'Project runner type does not support manual deployments',
        undefined,
        DEPLOYMENT_ERROR_CODE.PROJECT_RUNNER_NOT_SUPPORTED,
      ),
    );
  });

  it('throws a deployment error when required deploy config is missing', async () => {
    projects.findById.mockResolvedValue(makeProject({ containerName: null }));

    await expect(
      service.createManualDeployment('user-123', 'project-123'),
    ).rejects.toMatchObject(
      new ValidationError(
        'Project deploy configuration is incomplete',
        { missingFields: ['containerName'] },
        DEPLOYMENT_ERROR_CODE.PROJECT_DEPLOY_CONFIG_MISSING,
      ),
    );
  });

  it('propagates the active deployment conflict from the repository', async () => {
    projects.findById.mockResolvedValue(makeProject());
    deployments.createManualDeployment.mockRejectedValue(
      new ConflictError(
        'An active deployment already exists for this project',
        DEPLOYMENT_ERROR_CODE.ACTIVE_DEPLOYMENT_EXISTS,
      ),
    );

    await expect(
      service.createManualDeployment('user-123', 'project-123'),
    ).rejects.toMatchObject(
      new ConflictError(
        'An active deployment already exists for this project',
        DEPLOYMENT_ERROR_CODE.ACTIVE_DEPLOYMENT_EXISTS,
      ),
    );
  });
});
