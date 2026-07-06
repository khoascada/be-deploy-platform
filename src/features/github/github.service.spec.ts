import { GITHUB_ERROR_CODE } from '@/common/constants';
import { BadGatewayError } from '@/common/exceptions/app.exceptions';
import { GithubService } from './github.service';

describe('GithubService.deleteRepositoryWebhook', () => {
  const config = {
    get: jest.fn(),
  };
  const redis = {
    get: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
    getdel: jest.fn(),
  };
  const githubConnections = {
    findByUserId: jest.fn(),
  };
  const deployments = {
    recordGithubWebhook: jest.fn(),
  };
  const dispatch = {
    dispatch: jest.fn(),
  };

  let service: GithubService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'GITHUB_TOKEN_ENCRYPTION_KEY') {
        return '12345678901234567890123456789012';
      }

      return undefined;
    });
    service = new GithubService(
      config as never,
      redis as never,
      githubConnections as never,
      deployments as never,
      dispatch as never,
    );
    (service as unknown as { getGithubAccessToken: jest.Mock }).getGithubAccessToken =
      jest.fn().mockResolvedValue('github-token');
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('fails fast when the stored webhook id is invalid', async () => {
    await expect(
      service.deleteRepositoryWebhook('user-1', 'octocat', 'hello-world', 'abc'),
    ).rejects.toMatchObject({
      response: {
        code: GITHUB_ERROR_CODE.CANNOT_DELETE_REPOSITORY_WEBHOOK,
      },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('deletes the repository webhook when GitHub returns 204', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);

    await expect(
      service.deleteRepositoryWebhook('user-1', 'octocat', 'hello-world', '123'),
    ).resolves.toEqual({ deleted: true });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/octocat/hello-world/hooks/123',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer github-token',
          'User-Agent': 'deploy-platform',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      }),
    );
  });

  it('treats a 404 from GitHub as an already-removed webhook', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(
      service.deleteRepositoryWebhook('user-1', 'octocat', 'hello-world', '123'),
    ).resolves.toEqual({ deleted: false });
  });

  it('throws a bad gateway error when GitHub returns another error status', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(
      service.deleteRepositoryWebhook('user-1', 'octocat', 'hello-world', '123'),
    ).rejects.toMatchObject({
      response: {
        code: GITHUB_ERROR_CODE.CANNOT_DELETE_REPOSITORY_WEBHOOK,
      },
    });
  });

  it('throws a bad gateway error when the fetch request itself fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    await expect(
      service.deleteRepositoryWebhook('user-1', 'octocat', 'hello-world', '123'),
    ).rejects.toBeInstanceOf(BadGatewayError);
  });
});

