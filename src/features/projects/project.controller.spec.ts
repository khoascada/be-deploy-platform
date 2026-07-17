import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DeploymentRealtimeService } from '@/features/deployments/api/deployment-realtime.service';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

describe('ProjectController', () => {
  let app: INestApplication<App>;

  const projects = {
    deleteProject: jest.fn(),
    getDetail: jest.fn(),
    findAllByUserId: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
  };

  const deployments = {
    findLatestByProjectId: jest.fn(),
  };

  const realtime = {
    subscribeProject: jest.fn(),
    writeSseEvent: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: projects },
        { provide: DeploymentRepository, useValue: deployments },
        { provide: DeploymentRealtimeService, useValue: realtime },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
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

  it('returns 204 when deleting a project', async () => {
    projects.deleteProject.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete('/projects/project-1').expect(204);

    expect(projects.deleteProject).toHaveBeenCalledWith('user-1', 'project-1');
  });

  it('updates project settings for the current user', async () => {
    projects.updateProject.mockResolvedValue({ id: 'project-1' });

    await request(app.getHttpServer())
      .patch('/projects/project-1')
      .send({ autoDeploy: false })
      .expect(200);

    expect(projects.updateProject).toHaveBeenCalledWith(
      'user-1',
      'project-1',
      { autoDeploy: false },
    );
  });
});
