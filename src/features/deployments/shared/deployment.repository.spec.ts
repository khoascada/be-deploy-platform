import { DEPLOYMENT_ERROR_CODE } from '@/common/constants';
import { ConflictError } from '@/common/exceptions/app.exceptions';
import { DeploymentRepository } from '@/features/deployments/shared/deployment.repository';

type FakeDeployment = {
  id: string;
  projectId: string;
  deploymentNumber: number;
  trigger: 'MANUAL';
  status:
    | 'QUEUED'
    | 'PULLING'
    | 'BUILDING'
    | 'DEPLOYING'
    | 'SUCCESS'
    | 'FAILED'
    | 'CANCELED';
  branch: string;
  queuedAt: Date;
  createdAt: Date;
};

class FakePrismaService {
  deployments: FakeDeployment[] = [];
  private lock = Promise.resolve();

  async $transaction<T>(callback: (tx: FakeTransaction) => Promise<T>) {
    const release = { fn: () => undefined };
    const tx = new FakeTransaction(this, release);

    try {
      return await callback(tx);
    } finally {
      release.fn();
    }
  }

  async acquireLock() {
    const previous = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }
}

class FakeTransaction {
  constructor(
    private readonly prisma: FakePrismaService,
    private readonly release: { fn: () => void },
  ) {}

  async $executeRaw() {
    this.release.fn = await this.prisma.acquireLock();
    return 1;
  }

  deployment = {
    findFirst: (args: {
      where?: {
        projectId?: string;
        status?: { in: FakeDeployment['status'][] };
      };
      orderBy?: { deploymentNumber: 'asc' | 'desc' };
    }) => {
      let items = [...this.prisma.deployments];

      if (args.where?.projectId) {
        items = items.filter((item) => item.projectId === args.where?.projectId);
      }

      if (args.where?.status?.in) {
        items = items.filter((item) =>
          args.where?.status?.in.includes(item.status),
        );
      }

      if (args.orderBy?.deploymentNumber === 'desc') {
        items.sort((left, right) => right.deploymentNumber - left.deploymentNumber);
      }

      if (args.orderBy?.deploymentNumber === 'asc') {
        items.sort((left, right) => left.deploymentNumber - right.deploymentNumber);
      }

      return Promise.resolve(items[0] ?? null);
    },
    create: (args: {
      data: Omit<FakeDeployment, 'id' | 'createdAt'>;
    }) => {
      const deployment: FakeDeployment = {
        id: `deployment-${this.prisma.deployments.length + 1}`,
        createdAt: args.data.queuedAt,
        ...args.data,
      };
      this.prisma.deployments.push(deployment);
      return Promise.resolve(deployment);
    },
  };
}

describe('DeploymentRepository', () => {
  let prisma: FakePrismaService;
  let repository: DeploymentRepository;

  beforeEach(() => {
    prisma = new FakePrismaService();
    repository = new DeploymentRepository(prisma as never);
  });

  it('creates the first manual deployment with number 1', async () => {
    const result = await repository.createManualDeployment('project-123', 'main');

    expect(result.projectId).toBe('project-123');
    expect(result.deploymentNumber).toBe(1);
    expect(result.trigger).toBe('MANUAL');
    expect(result.status).toBe('QUEUED');
    expect(result.branch).toBe('main');
  });

  it('rejects when an active deployment already exists', async () => {
    prisma.deployments.push({
      id: 'deployment-existing',
      projectId: 'project-123',
      deploymentNumber: 1,
      trigger: 'MANUAL',
      status: 'QUEUED',
      branch: 'main',
      queuedAt: new Date('2026-06-29T10:00:00.000Z'),
      createdAt: new Date('2026-06-29T10:00:00.000Z'),
    });

    await expect(
      repository.createManualDeployment('project-123', 'main'),
    ).rejects.toMatchObject(
      new ConflictError(
        'An active deployment already exists for this project',
        DEPLOYMENT_ERROR_CODE.ACTIVE_DEPLOYMENT_EXISTS,
      ),
    );
  });

  it('increments deploymentNumber after completed deployments', async () => {
    prisma.deployments.push({
      id: 'deployment-existing',
      projectId: 'project-123',
      deploymentNumber: 1,
      trigger: 'MANUAL',
      status: 'SUCCESS',
      branch: 'main',
      queuedAt: new Date('2026-06-29T10:00:00.000Z'),
      createdAt: new Date('2026-06-29T10:00:00.000Z'),
    });

    const result = await repository.createManualDeployment('project-123', 'main');

    expect(result.deploymentNumber).toBe(2);
  });

  it('serializes concurrent requests so only one queued deployment is created', async () => {
    const [first, second] = await Promise.allSettled([
      repository.createManualDeployment('project-123', 'main'),
      repository.createManualDeployment('project-123', 'main'),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');

    if (first.status === 'fulfilled') {
      expect(first.value.deploymentNumber).toBe(1);
    }

    if (second.status === 'rejected') {
      expect(second.reason).toMatchObject(
        new ConflictError(
          'An active deployment already exists for this project',
          DEPLOYMENT_ERROR_CODE.ACTIVE_DEPLOYMENT_EXISTS,
        ),
      );
    }

    expect(prisma.deployments).toHaveLength(1);
    expect(prisma.deployments[0]?.deploymentNumber).toBe(1);
  });
});
