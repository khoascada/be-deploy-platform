import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DeploymentController } from './deployment.controller';
import { DeploymentAccessService } from './deployment-access.service';
import { DeploymentRealtimeService } from './deployment-realtime.service';
import { DeploymentService } from './deployment.service';

describe('DeploymentController', () => {
  let app: INestApplication<App>;

  const deployments = {
    createManualDeployment: jest.fn(),
    getProjectDeployments: jest.fn(),
  };

  const deploymentAccess = {
    assertDeploymentAccess: jest.fn(),
  };

  const realtime = {
    subscribe: jest.fn(),
    writeSseEvent: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentController],
      providers: [
        { provide: DeploymentService, useValue: deployments },
        { provide: DeploymentAccessService, useValue: deploymentAccess },
        { provide: DeploymentRealtimeService, useValue: realtime },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    app.use((request: Request, _response: Response, next: NextFunction) => {
      request.user = { id: 'user-1' };
      next();
    });
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('lists recent deployments for a project with the default limit', async () => {
    deployments.getProjectDeployments.mockResolvedValue([
      {
        id: 'deployment-2',
        projectId: 'project-1',
        deploymentNumber: 2,
        trigger: 'MANUAL',
        status: 'SUCCESS',
        branch: 'main',
        commitSha: 'abc123',
        commitMessage: 'Deploy app',
        queuedAt: '2026-07-02T00:00:00.000Z',
        createdAt: '2026-07-02T00:00:00.000Z',
        finishedAt: '2026-07-02T00:05:00.000Z',
      },
    ]);

    await request(app.getHttpServer())
      .get('/projects/project-1/deployments')
      .expect(200)
      .expect([
        {
          id: 'deployment-2',
          projectId: 'project-1',
          deploymentNumber: 2,
          trigger: 'MANUAL',
          status: 'SUCCESS',
          branch: 'main',
          commitSha: 'abc123',
          commitMessage: 'Deploy app',
          queuedAt: '2026-07-02T00:00:00.000Z',
          createdAt: '2026-07-02T00:00:00.000Z',
          finishedAt: '2026-07-02T00:05:00.000Z',
        },
      ]);

    expect(deployments.getProjectDeployments).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      20,
    );
  });

  it('passes through a custom limit for deployment history', async () => {
    deployments.getProjectDeployments.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/projects/project-1/deployments?limit=5')
      .expect(200);

    expect(deployments.getProjectDeployments).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      5,
    );
  });
});
