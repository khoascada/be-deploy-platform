import { ProjectRepository } from './project.repository';
import { PROJECT_ERROR_CODE } from '@/common/constants';

describe('ProjectRepository.findById', () => {
  it('loads only the latest webhook event', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const repository = new ProjectRepository({ project: { findUnique } } as never);

    await repository.findById('project-1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      include: {
        deployments: true,
        webhookEvents: {
          take: 1,
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
  });
});

describe('ProjectRepository.updateSettings', () => {
  it('maps a duplicate host port to the project conflict code', async () => {
    const update = jest.fn().mockRejectedValue({
      code: 'P2002',
      meta: { target: ['hostPort'] },
    });
    const repository = new ProjectRepository({ project: { update } } as never);

    await expect(
      repository.updateSettings('project-1', { hostPort: 8080 }),
    ).rejects.toMatchObject({
      response: { code: PROJECT_ERROR_CODE.HOST_PORT_ALREADY_EXISTS },
    });
  });
});
