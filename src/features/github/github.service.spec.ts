import { GithubConnectionStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { RedisService } from '../../redis/redis.service';
import {
  decryptGithubToken,
  encryptGithubToken,
} from './github-token-cipher';
import type { GithubRepository } from './github.repository';
import { GithubService } from './github.service';
import { githubOAuthStateSchema } from './schemas/github.schema';

describe('GithubService', () => {
  const encryptionKey = Buffer.alloc(32, 9).toString('base64');
  const configValues: Record<string, string> = {
    FRONTEND_URL: 'http://localhost:2805',
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    GITHUB_OAUTH_REDIRECT_URI:
      'http://localhost:2702/api/v1/github/oauth/callback',
    GITHUB_OAUTH_SCOPE: 'read:user repo',
    GITHUB_TOKEN_ENCRYPTION_KEY: encryptionKey,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const redisSetex = jest.fn<
    ReturnType<RedisService['setex']>,
    Parameters<RedisService['setex']>
  >();
  const redisGetdel = jest.fn<
    ReturnType<RedisService['getdel']>,
    Parameters<RedisService['getdel']>
  >();
  const findUserWithConnection = jest.fn<
    ReturnType<GithubRepository['findUserWithConnection']>,
    Parameters<GithubRepository['findUserWithConnection']>
  >();
  const findByGithubUserId = jest.fn<
    ReturnType<GithubRepository['findByGithubUserId']>,
    Parameters<GithubRepository['findByGithubUserId']>
  >();
  const findByUserId = jest.fn<
    ReturnType<GithubRepository['findByUserId']>,
    Parameters<GithubRepository['findByUserId']>
  >();
  const createConnection = jest.fn<
    ReturnType<GithubRepository['create']>,
    Parameters<GithubRepository['create']>
  >();

  const redis = {
    setex: redisSetex,
    getdel: redisGetdel,
  } as unknown as RedisService;
  const githubConnections = {
    findUserWithConnection,
    findByGithubUserId,
    findByUserId,
    create: createConnection,
  } as unknown as GithubRepository;

  let service: GithubService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GithubService(config as never, redis, githubConnections);
  });

  afterEach(() => jest.restoreAllMocks());

  it('stores state with a PKCE verifier and builds an S256 challenge', async () => {
    let storedStatePayload = '';
    redisSetex.mockImplementation(
      (_key: string, _ttl: number, value: string) => {
        storedStatePayload = value;
        return Promise.resolve('OK');
      },
    );

    const redirect = await service.getOAuthLoginRedirect('user-1');
    const url = new URL(redirect.url);
    const state = url.searchParams.get('state');

    expect(redirect.statusCode).toBe(302);
    expect(state).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(redisSetex).toHaveBeenCalledWith(
      'oauth:github:state:' + state,
      300,
      expect.any(String),
    );

    const payload = githubOAuthStateSchema.parse(
      JSON.parse(storedStatePayload) as unknown,
    );
    expect(payload).toMatchObject({ userId: 'user-1' });
    expect(payload.codeVerifier).toHaveLength(43);
  });

  it('redirects an expired or replayed state without calling GitHub', async () => {
    redisGetdel.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(global, 'fetch');

    const redirect = await service.oAuthCallback({
      code: 'github-code',
      state: 'expired-state',
    });

    expect(redirect.url).toBe(
      'http://localhost:2805/projects?connectGithub=error&reason=invalid_state',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('consumes state and redirects access_denied without calling GitHub', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    const fetchSpy = jest.spyOn(global, 'fetch');

    const redirect = await service.oAuthCallback({
      error: 'access_denied',
      error_description: 'The user denied access',
      state: 'oauth-state',
    });

    expect(redisGetdel).toHaveBeenCalledWith(
      'oauth:github:state:oauth-state',
    );
    expect(redirect.url).toContain('reason=access_denied');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not exchange a code when the platform user is missing', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    findUserWithConnection.mockResolvedValue(null);
    const fetchSpy = jest.spyOn(global, 'fetch');

    const redirect = await service.oAuthCallback(successQuery());

    expect(redirect.url).toContain('reason=user_not_found');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing user connection', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    findUserWithConnection.mockResolvedValue({
      id: 'user-1',
      githubConnection: { id: 'connection-1' },
    });

    const redirect = await service.oAuthCallback(successQuery());

    expect(redirect.url).toContain('reason=already_connected');
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('creates an encrypted GitHub connection and redirects to projects', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    findUserWithConnection.mockResolvedValue({
      id: 'user-1',
      githubConnection: null,
    });
    findByGithubUserId.mockResolvedValue(null);
    createConnection.mockResolvedValue({
      id: 'connection-1',
      userId: 'user-1',
      githubUserId: '12345',
      username: 'octocat',
      displayName: 'The Octocat',
      avatarUrl: null,
      accessTokenEncrypted: 'encrypted',
      scopes: 'read:user,repo',
      status: GithubConnectionStatus.CONNECTED,
      revokedAt: null,
      connectedAt: new Date(),
      updatedAt: new Date(),
    });
    mockSuccessfulGithubRequests();

    const redirect = await service.oAuthCallback(successQuery());

    expect(redirect).toEqual({
      statusCode: 302,
      url: 'http://localhost:2805/projects?connectGithub=connected',
    });
    const createdData = createConnection.mock.calls[0]?.[0];
    expect(createdData).toMatchObject({
      userId: 'user-1',
      githubUserId: '12345',
      username: 'octocat',
      displayName: 'The Octocat',
      avatarUrl: 'https://github.com/images/error/octocat_happy.gif',
      scopes: 'read:user,repo',
    });
    if (!createdData) {
      throw new Error('Expected GitHub connection data');
    }

    const encrypted = createdData.accessTokenEncrypted;
    expect(encrypted).not.toContain('gho_access_token');
    expect(decryptGithubToken(encrypted, encryptionKey)).toBe(
      'gho_access_token',
    );
  });

  it('rejects a GitHub account connected to another user', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    findUserWithConnection.mockResolvedValue({
      id: 'user-1',
      githubConnection: null,
    });
    findByGithubUserId.mockResolvedValue({
      id: 'connection-2',
      userId: 'user-2',
    });
    mockSuccessfulGithubRequests();

    const redirect = await service.oAuthCallback(successQuery());

    expect(redirect.url).toContain('reason=account_in_use');
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('maps a bad verification code to authorization_expired', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    findUserWithConnection.mockResolvedValue({
      id: 'user-1',
      githubConnection: null,
    });
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        error: 'bad_verification_code',
        error_description: 'The code passed is incorrect or expired.',
      }),
    );

    const redirect = await service.oAuthCallback(successQuery());

    expect(redirect.url).toContain('reason=authorization_expired');
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('rejects an invalid GitHub profile response', async () => {
    redisGetdel.mockResolvedValue(oauthState());
    findUserWithConnection.mockResolvedValue({
      id: 'user-1',
      githubConnection: null,
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'gho_access_token',
          token_type: 'bearer',
          scope: 'read:user,repo',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'not-a-number' }));

    const redirect = await service.oAuthCallback(successQuery());

    expect(redirect.url).toContain('reason=connection_failed');
    expect(createConnection).not.toHaveBeenCalled();
  });

  it('rejects listing repos when the user has not connected GitHub', async () => {
    findByUserId.mockResolvedValue(null);

    await expect(
      service.getListRepos({ page: 1, limit: 10 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'NOT_CONNECTED_GITHUB_YET',
        message: 'User has not connected GitHub yet',
      },
      status: 409,
    });
  });

  it('returns compact repo items when GitHub responds with a single page', async () => {
    findByUserId.mockResolvedValue(connectedGithubAccount());
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse([
        {
          id: 1,
          name: 'deploy-platform',
          full_name: 'octocat/deploy-platform',
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/octocat/deploy-platform',
          owner: {
            login: 'octocat',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          },
        },
      ]),
    );

    await expect(
      service.getListRepos({ page: 1, limit: 10 }, 'user-1'),
    ).resolves.toEqual({
      items: [
        {
          id: '1',
          name: 'deploy-platform',
          fullName: 'octocat/deploy-platform',
          owner: {
            login: 'octocat',
            avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
          },
          url: 'https://github.com/octocat/deploy-platform',
          defaultBranch: 'main',
          private: false,
        },
      ],
      meta: { total: 1 },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/user/repos?page=1&per_page=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer gho_access_token',
          'User-Agent': 'deploy-platform',
          'X-GitHub-Api-Version': '2022-11-28',
        }),
      }),
    );
  });

  it('follows Link rel="next" and merges all repo pages', async () => {
    findByUserId.mockResolvedValue(connectedGithubAccount());
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          [
            {
              id: 1,
              name: 'api',
              full_name: 'octocat/api',
              private: false,
              default_branch: 'main',
              html_url: 'https://github.com/octocat/api',
              owner: { login: 'octocat', avatar_url: null },
            },
          ],
          200,
          {
            Link: '<https://api.github.com/user/repos?page=2&per_page=100>; rel="next", <https://api.github.com/user/repos?page=2&per_page=100>; rel="last"',
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 2,
            name: 'web',
            full_name: 'octocat/web',
            private: true,
            default_branch: 'develop',
            html_url: 'https://github.com/octocat/web',
            owner: { login: 'octocat', avatar_url: null },
          },
        ]),
      );

    await expect(
      service.getListRepos({ page: 1, limit: 10 }, 'user-1'),
    ).resolves.toEqual({
      items: [
        {
          id: '1',
          name: 'api',
          fullName: 'octocat/api',
          owner: {
            login: 'octocat',
            avatarUrl: null,
          },
          url: 'https://github.com/octocat/api',
          defaultBranch: 'main',
          private: false,
        },
        {
          id: '2',
          name: 'web',
          fullName: 'octocat/web',
          owner: {
            login: 'octocat',
            avatarUrl: null,
          },
          url: 'https://github.com/octocat/web',
          defaultBranch: 'develop',
          private: true,
        },
      ],
      meta: { total: 2 },
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/user/repos?page=2&per_page=100',
      expect.any(Object),
    );
  });

  it('throws a domain error when a later GitHub repo page fails', async () => {
    findByUserId.mockResolvedValue(connectedGithubAccount());
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          [],
          200,
          {
            Link: '<https://api.github.com/user/repos?page=2&per_page=100>; rel="next"',
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ message: 'Bad credentials' }, 401));

    await expect(
      service.getListRepos({ page: 1, limit: 10 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'CANNOT_GET_LIST_REPOS_FROM_GITHUB',
        message: 'Cannot get list repos from GitHub',
      },
      status: 400,
    });
  });

  it('throws a domain error when the GitHub repo payload shape is invalid', async () => {
    findByUserId.mockResolvedValue(connectedGithubAccount());
    jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse([{ id: 'invalid-id' }]),
    );

    await expect(
      service.getListRepos({ page: 1, limit: 10 }, 'user-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'CANNOT_GET_LIST_REPOS_FROM_GITHUB',
        message: 'Cannot get list repos from GitHub',
      },
      status: 400,
    });
  });

  function successQuery() {
    return { code: 'github-code', state: 'oauth-state' } as const;
  }

  function oauthState() {
    return JSON.stringify({
      userId: 'user-1',
      codeVerifier: 'v'.repeat(43),
      createdAt: Date.now(),
    });
  }

  function connectedGithubAccount() {
    return {
      id: 'connection-1',
      userId: 'user-1',
      githubUserId: '12345',
      username: 'octocat',
      displayName: 'The Octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      accessTokenEncrypted: encryptGithubToken('gho_access_token', encryptionKey),
      scopes: 'repo',
      status: GithubConnectionStatus.CONNECTED,
      revokedAt: null,
      connectedAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function mockSuccessfulGithubRequests() {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'gho_access_token',
          token_type: 'bearer',
          scope: 'read:user,repo',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 12345,
          login: 'octocat',
          name: 'The Octocat',
          avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        }),
      );
  }

  function jsonResponse(
    body: unknown,
    status = 200,
    headers?: Record<string, string>,
  ) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }
});
