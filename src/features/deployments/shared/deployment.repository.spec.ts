/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DeploymentStatus, WebhookEventStatus } from '@prisma/client';
import {
  DeploymentRepository,
  type GithubWebhookRecordInput,
} from './deployment.repository';

describe('DeploymentRepository GitHub webhook lifecycle', () => {
  const webhookEvent = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  };
  const deployment = {
    findFirst: jest.fn(),
    create: jest.fn(),
  };
  const tx = {
    $executeRaw: jest.fn(),
    webhookEvent,
    deployment,
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };

  const push = {
    branch: 'main',
    commitSha: 'abc123',
    commitMessage: 'feat: deploy',
    commitAuthorName: 'Khoa',
    commitAuthorEmail: 'khoa@example.com',
  };
  const baseInput: GithubWebhookRecordInput = {
    projectId: 'project-1',
    githubDeliveryId: 'delivery-1',
    eventName: 'push',
    action: null,
    signature: 'sha256=valid',
    isVerified: true,
    payload: {
      ref: 'refs/heads/main',
      head_commit: {
        id: push.commitSha,
        message: push.commitMessage,
        author: {
          name: push.commitAuthorName,
          email: push.commitAuthorEmail,
        },
      },
    },
    push,
  };

  let repository: DeploymentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DeploymentRepository(prisma as never);
    webhookEvent.findUnique.mockResolvedValue(null);
    webhookEvent.create.mockResolvedValue({ id: 'event-1' });
    webhookEvent.update.mockResolvedValue({ id: 'event-1' });
    webhookEvent.updateMany.mockResolvedValue({ count: 0 });
  });

  it('records an invalid signature as FAILED', async () => {
    await repository.recordGithubWebhook({
      ...baseInput,
      isVerified: false,
      ignoreReason: 'Invalid signature',
      push: undefined,
    });

    expect(webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: WebhookEventStatus.FAILED,
        statusReason: 'Invalid signature',
        processedAt: expect.any(Date),
      }),
    });
    expect(deployment.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    'Branch dev does not match deploy branch main',
    'Unsupported event: pull_request',
    'Auto deploy is disabled',
  ])('records an ignored webhook as IGNORED: %s', async (ignoreReason) => {
    await repository.recordGithubWebhook({
      ...baseInput,
      ignoreReason,
      push: undefined,
    });

    expect(webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: WebhookEventStatus.IGNORED,
        statusReason: ignoreReason,
        processedAt: expect.any(Date),
      }),
    });
  });

  it('marks a valid push as PENDING while another deployment is active', async () => {
    deployment.findFirst.mockResolvedValue({
      id: 'active-deployment',
      status: DeploymentStatus.BUILDING,
    });

    await repository.recordGithubWebhook(baseInput);

    expect(webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: WebhookEventStatus.PENDING },
    });
    expect(deployment.create).not.toHaveBeenCalled();
  });

  it('marks a valid push as PROCESSED after creating its deployment', async () => {
    deployment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    deployment.create.mockResolvedValue({ id: 'deployment-1' });

    const result = await repository.recordGithubWebhook(baseInput);

    expect(webhookEvent.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: WebhookEventStatus.PENDING }),
      data: expect.objectContaining({
        status: WebhookEventStatus.SUPERSEDED,
        statusReason: 'Superseded by a newer push',
      }),
    });
    expect(webhookEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-1' },
      data: {
        status: WebhookEventStatus.PROCESSED,
        statusReason: null,
        processedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({
      duplicate: false,
      deployment: { id: 'deployment-1' },
    });
  });

  it('does not create another event for a duplicate delivery', async () => {
    webhookEvent.findUnique.mockResolvedValue({ id: 'existing-event' });

    await expect(repository.recordGithubWebhook(baseInput)).resolves.toEqual({
      duplicate: true,
      deployment: null,
    });
    expect(webhookEvent.create).not.toHaveBeenCalled();
  });

  it('promotes only PENDING events and supersedes all but the latest', async () => {
    deployment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    deployment.create.mockResolvedValue({ id: 'deployment-2' });
    webhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-latest',
        githubDeliveryId: 'delivery-latest',
        payload: baseInput.payload,
      },
      {
        id: 'event-old',
        githubDeliveryId: 'delivery-old',
        payload: baseInput.payload,
      },
    ]);

    await repository.promoteLatestPendingGithubPush('project-1');

    expect(webhookEvent.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        eventName: 'push',
        isVerified: true,
        status: WebhookEventStatus.PENDING,
      },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    });
    expect(webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['event-old'] } },
      data: {
        status: WebhookEventStatus.SUPERSEDED,
        processedAt: expect.any(Date),
        statusReason: 'Superseded by a newer push',
      },
    });
    expect(webhookEvent.update).toHaveBeenLastCalledWith({
      where: { id: 'event-latest' },
      data: {
        status: WebhookEventStatus.PROCESSED,
        statusReason: null,
        processedAt: expect.any(Date),
      },
    });
  });

  it('marks an invalid stored pending payload as FAILED', async () => {
    deployment.findFirst.mockResolvedValue(null);
    webhookEvent.findMany.mockResolvedValue([
      {
        id: 'event-invalid',
        githubDeliveryId: 'delivery-invalid',
        payload: { ref: 'invalid-ref' },
      },
    ]);

    await expect(
      repository.promoteLatestPendingGithubPush('project-1'),
    ).resolves.toBeNull();
    expect(webhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-invalid' },
      data: {
        status: WebhookEventStatus.FAILED,
        processedAt: expect.any(Date),
        statusReason: 'Invalid stored push payload',
      },
    });
  });
});
