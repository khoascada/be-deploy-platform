import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import type { App } from 'supertest/types';
import { GithubController } from './github.controller';
import { GithubService } from './github.service';

describe('GithubController', () => {
  let app: INestApplication<App>;

  const github = {
    getOAuthLoginRedirect: jest.fn(),
    oAuthCallback: jest.fn(),
    handleRepositoryWebhook: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GithubController],
      providers: [{ provide: GithubService, useValue: github }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
  });

  it('redirects the login request to GitHub', async () => {
    github.getOAuthLoginRedirect.mockResolvedValue({
      statusCode: 302,
      url: 'https://github.com/login/oauth/authorize?client_id=test',
    });

    await request(app.getHttpServer())
      .get('/github/oauth/login')
      .expect(302)
      .expect(
        'Location',
        'https://github.com/login/oauth/authorize?client_id=test',
      );
  });

  it('redirects a successful callback to the frontend', async () => {
    github.oAuthCallback.mockResolvedValue({
      statusCode: 302,
      url: 'http://localhost:2805/projects',
    });

    await request(app.getHttpServer())
      .get('/github/oauth/callback?code=github-code&state=oauth-state')
      .expect(302)
      .expect('Location', 'http://localhost:2805/projects');
  });

  it('accepts access_denied and redirects to the frontend', async () => {
    github.oAuthCallback.mockResolvedValue({
      statusCode: 302,
      url: 'http://localhost:2805/projects?github=error&reason=access_denied',
    });

    await request(app.getHttpServer())
      .get(
        '/github/oauth/callback?error=access_denied&error_description=Denied&state=oauth-state',
      )
      .expect(302)
      .expect(
        'Location',
        'http://localhost:2805/projects?github=error&reason=access_denied',
      );
  });

  it('accepts repository webhooks', async () => {
    github.handleRepositoryWebhook.mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/github/webhooks/repository')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .set('x-github-hook-id', 'hook-1')
      .set('x-hub-signature-256', 'sha256=test')
      .send({ repository: { id: 1 } })
      .expect(204);

    expect(github.handleRepositoryWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'push',
        deliveryId: 'delivery-1',
        hookId: 'hook-1',
        signature: 'sha256=test',
        payload: { repository: { id: 1 } },
      }),
    );
  });
});
