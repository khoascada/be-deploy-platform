import { WebhookEventStatus } from '@prisma/client';
import { toProjectDetailDto } from './project-detail-response.dto';

const project = {
  id: 'project-1',
  ownerId: 'user-1',
  name: 'Deploy Platform',
  slug: 'deploy-platform',
  repoFullName: 'khoa/deploy-platform',
  repoOwner: 'khoa',
  repoName: 'deploy-platform',
  repoUrl: 'https://github.com/khoa/deploy-platform',
  githubRepoId: '123',
  githubDefaultBranch: 'main',
  deployBranch: 'main',
  rootDirectory: '.',
  dockerfilePath: 'Dockerfile',
  buildContext: '.',
  runnerType: 'LOCAL' as const,
  localRepoPath: null,
  sshHost: null,
  sshPort: null,
  sshUser: null,
  sshKeyEncrypted: null,
  containerPort: 3000,
  hostPort: 8080,
  containerName: 'deploy-platform',
  imageName: 'deploy-platform',
  autoDeploy: true,
  webhookId: '456',
  webhookSecretEncrypted: 'encrypted',
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-07-11T09:00:00.000Z'),
  updatedAt: new Date('2026-07-11T09:30:00.000Z'),
  deployments: [],
};

describe('toProjectDetailDto latestWebhookEvent', () => {
  it('returns null when the project has no webhook event', () => {
    expect(toProjectDetailDto({ ...project, webhookEvents: [] }).latestWebhookEvent).toBeNull();
  });

  it('maps sanitized branch and commit metadata from a push payload', () => {
    const result = toProjectDetailDto({
      ...project,
      webhookEvents: [
        {
          id: 'event-1',
          eventName: 'push',
          status: WebhookEventStatus.PROCESSED,
          statusReason: null,
          isVerified: true,
          payload: {
            ref: 'refs/heads/main',
            head_commit: {
              id: 'abc123def456',
              message: 'feat: show latest webhook',
              author: { email: 'private@example.com' },
            },
          },
          receivedAt: new Date('2026-07-11T10:00:00.000Z'),
          processedAt: new Date('2026-07-11T10:00:01.000Z'),
        },
      ],
    });

    expect(result.latestWebhookEvent).toEqual({
      id: 'event-1',
      eventName: 'push',
      status: WebhookEventStatus.PROCESSED,
      statusReason: null,
      isVerified: true,
      receivedAt: '2026-07-11T10:00:00.000Z',
      processedAt: '2026-07-11T10:00:01.000Z',
      branch: 'main',
      commitSha: 'abc123def456',
      commitMessage: 'feat: show latest webhook',
    });
    expect(result.latestWebhookEvent).not.toHaveProperty('payload');
    expect(result.latestWebhookEvent).not.toHaveProperty('signature');
  });

  it.each([
    ['non-push event', 'ping', { zen: 'Keep it logically awesome.' }],
    ['invalid push payload', 'push', { ref: 'invalid' }],
  ])('returns null commit metadata for %s', (_label, eventName, payload) => {
    const result = toProjectDetailDto({
      ...project,
      webhookEvents: [
        {
          id: 'event-2',
          eventName,
          status: WebhookEventStatus.IGNORED,
          statusReason: 'Unsupported event',
          isVerified: true,
          payload,
          receivedAt: new Date('2026-07-11T10:00:00.000Z'),
          processedAt: new Date('2026-07-11T10:00:01.000Z'),
        },
      ],
    });

    expect(result.latestWebhookEvent).toMatchObject({
      branch: null,
      commitSha: null,
      commitMessage: null,
    });
  });
});
