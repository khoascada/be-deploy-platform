import type { AuthUser } from '@/common/decorators/current-user.decorator';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';

describe('DeploymentController', () => {
  let app: INestApplication<App>;

  const deployments = {
    createManualDeployment: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentController],
      providers: [{ provide: DeploymentService, useValue: deployments }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(
      (
        req: { user?: AuthUser },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = {
          id: 'user-123',
          email: 'owner@example.com',
          role: 'USER',
          jti: 'jti-123',
          exp: Date.now() + 60_000,
        };
        next();
      },
    );
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('creates a manual deployment for the current authenticated user', async () => {
    deployments.createManualDeployment.mockResolvedValue({
      id: 'deployment-1',
      projectId: 'project-123',
      deploymentNumber: 1,
      trigger: 'MANUAL',
      status: 'QUEUED',
      branch: 'main',
      queuedAt: '2026-06-29T10:00:00.000Z',
      createdAt: '2026-06-29T10:00:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/projects/project-123/deployments')
      .expect(201)
      .expect({
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
      'user-123',
      'project-123',
    );
  });
});
