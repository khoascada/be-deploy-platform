import { GITHUB_ERROR_CODE } from '@/common/constants';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '@/common/exceptions/app.exceptions';
import type { EnvVars } from '@/config/env.validation';
import { RedisService } from '@/redis/redis.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { toGithubBranchListItemDto } from './dto/github-branch-list-response.dto';
import { toGithubRepoListItemDto } from './dto/github-repo-list-response.dto';
import {
  decryptGithubToken,
  encryptGithubToken,
  encryptGithubWebhookSecret,
} from './github-token-cipher';
import { GithubRepository } from './github.repository';
import {
  githubBranchListResponseSchema,
  githubBranchListSchema,
  githubCallbackQuerySchema,
  githubOAuthStateSchema,
  githubRepoListResponseSchema,
  githubRepositoryListSchema,
  githubTokenErrorResponseSchema,
  githubTokenSuccessResponseSchema,
  githubUserProfileSchema,
  type GithubRepository as GithubApiRepository,
  type GithubBranch,
  type GithubBranchListResponse,
  type GithubRepoListResponse,
} from './schemas/github.schema';

const OAUTH_STATE_TTL_SECONDS = 300;
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_REPOS_PER_PAGE = 100;
const GITHUB_BRANCHES_PER_PAGE = 100;
const GITHUB_CACHE_TTL_SECONDS = 3600;

type CallbackFailureReason =
  | 'access_denied'
  | 'invalid_state'
  | 'user_not_found'
  | 'already_connected'
  | 'account_in_use'
  | 'authorization_expired'
  | 'oauth_configuration_error'
  | 'connection_failed';

class GithubCallbackError extends Error {
  constructor(readonly reason: CallbackFailureReason) {
    super(reason);
  }
}

@Injectable()
export class GithubService {
  private static readonly AUTHORIZE_URL =
    'https://github.com/login/oauth/authorize';
  private static readonly TOKEN_URL =
    'https://github.com/login/oauth/access_token';
  private static readonly USER_URL = 'https://api.github.com/user';
  private static readonly USER_REPOS_URL = 'https://api.github.com/user/repos';
  private static readonly REPO_BRANCHES_URL = 'https://api.github.com/repos';

  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly redis: RedisService,
    private readonly githubConnections: GithubRepository,
  ) {}

  async getOAuthLoginRedirect(userId: string) {
    const clientId = this.config.get('GITHUB_CLIENT_ID', { infer: true });
    const redirectUri = this.config.get('GITHUB_OAUTH_REDIRECT_URI', {
      infer: true,
    });

    if (!clientId || !redirectUri) {
      throw new GithubCallbackError('oauth_configuration_error');
    }

    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    await this.redis.setex(
      'oauth:github:state:' + state,
      OAUTH_STATE_TTL_SECONDS,
      JSON.stringify({
        userId,
        codeVerifier,
        createdAt: Date.now(),
      }),
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    const scope = this.config.get('GITHUB_OAUTH_SCOPE', { infer: true });
    if (scope) {
      params.set('scope', scope);
    }

    return {
      statusCode: HttpStatus.FOUND,
      url: GithubService.AUTHORIZE_URL + '?' + params.toString(),
    };
  }

  async oAuthCallback(rawQuery: unknown) {
    const projectsUrl = this.getProjectsUrl();
    const query = githubCallbackQuerySchema.parse(rawQuery);

    try {
      const oauthState = await this.consumeOAuthState(query.state);

      if (query.error) {
        throw new GithubCallbackError(
          query.error === 'access_denied'
            ? 'access_denied'
            : query.error === 'redirect_uri_mismatch' ||
                query.error === 'application_suspended'
              ? 'oauth_configuration_error'
              : 'connection_failed',
        );
      }

      const user = await this.githubConnections.findUserWithConnection(
        oauthState.userId,
      );
      if (!user) {
        throw new GithubCallbackError('user_not_found');
      }
      if (user.githubConnection) {
        throw new GithubCallbackError('already_connected');
      }

      if (!query.code) {
        throw new GithubCallbackError('connection_failed');
      }

      const token = await this.exchangeCode(
        query.code,
        oauthState.codeVerifier,
      );
      const profile = await this.getGithubProfile(token.access_token);
      const existingConnection =
        await this.githubConnections.findByGithubUserId(String(profile.id));

      if (existingConnection) {
        throw new GithubCallbackError('account_in_use');
      }

      const encryptionKey = this.config.get('GITHUB_TOKEN_ENCRYPTION_KEY', {
        infer: true,
      });
      if (!encryptionKey) {
        throw new GithubCallbackError('oauth_configuration_error');
      }

      try {
        await this.githubConnections.create({
          userId: oauthState.userId,
          githubUserId: String(profile.id),
          username: profile.login,
          displayName: profile.name,
          avatarUrl: profile.avatar_url,
          accessTokenEncrypted: encryptGithubToken(
            token.access_token,
            encryptionKey,
          ),
          scopes: token.scope || null,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new GithubCallbackError('account_in_use');
        }
        throw error;
      }

      const successUrl = new URL(projectsUrl);
      successUrl.searchParams.set('connectGithub', 'connected');

      return { statusCode: HttpStatus.FOUND, url: successUrl.toString() };
    } catch (error) {
      const reason =
        error instanceof GithubCallbackError
          ? error.reason
          : 'connection_failed';

      if (!(error instanceof GithubCallbackError)) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error('GitHub OAuth callback failed with ' + errorName);
      }

      const errorUrl = new URL(projectsUrl);
      errorUrl.searchParams.set('connectGithub', 'error');
      errorUrl.searchParams.set('reason', reason);

      return {
        statusCode: HttpStatus.FOUND,
        url: errorUrl.toString(),
      };
    }
  }

  async getListRepos(userId: string, isRefresh: boolean) {
    const cacheKey = this.getRepoCacheKey(userId);

    if (!isRefresh) {
      const cachedValue = await this.redis.get(cacheKey);
      const cachedRepos = this.parseCachedRepoList(cachedValue);
      if (cachedRepos) {
        return cachedRepos;
      }
      if (cachedValue !== null) {
        await this.redis.del(cacheKey);
      }
    }

    const accessToken = await this.getGithubAccessToken(userId);
    const repos = await this.getListReposFromGithub(accessToken);

    const response: GithubRepoListResponse = {
      items: repos.map((repo) => toGithubRepoListItemDto(repo)),
      meta: { total: repos.length },
    };

    await this.redis.setex(
      cacheKey,
      GITHUB_CACHE_TTL_SECONDS,
      JSON.stringify(response),
    );

    return response;
  }

  async getListBranches(
    userId: string,
    owner: string,
    repo: string,
    isRefresh: boolean,
  ) {
    const cacheKey = this.getBranchCacheKey(userId, owner, repo);

    if (!isRefresh) {
      const cachedValue = await this.redis.get(cacheKey);
      const cachedBranches = this.parseCachedBranchList(cachedValue);
      if (cachedBranches) {
        return cachedBranches;
      }
      if (cachedValue !== null) {
        await this.redis.del(cacheKey);
      }
    }

    const accessToken = await this.getGithubAccessToken(userId);
    const branches = await this.getListBranchesFromGithub(
      accessToken,
      owner,
      repo,
    );

    const response: GithubBranchListResponse = {
      items: branches.map((branch) => toGithubBranchListItemDto(branch)),
      meta: { total: branches.length },
    };

    await this.redis.setex(
      cacheKey,
      GITHUB_CACHE_TTL_SECONDS,
      JSON.stringify(response),
    );

    return response;
  }

  async getAccessTokenForUser(userId: string): Promise<string> {
    return this.getGithubAccessToken(userId);
  }

  private async consumeOAuthState(state: string) {
    const value = await this.redis.getdel('oauth:github:state:' + state);
    if (!value) {
      throw new GithubCallbackError('invalid_state');
    }

    try {
      return githubOAuthStateSchema.parse(JSON.parse(value) as unknown);
    } catch {
      throw new GithubCallbackError('invalid_state');
    }
  }

  private async exchangeCode(code: string, codeVerifier: string) {
    const clientId = this.config.get('GITHUB_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GITHUB_CLIENT_SECRET', {
      infer: true,
    });
    const redirectUri = this.config.get('GITHUB_OAUTH_REDIRECT_URI', {
      infer: true,
    });

    if (!clientId || !clientSecret || !redirectUri) {
      throw new GithubCallbackError('oauth_configuration_error');
    }

    const response = await fetch(GithubService.TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'deploy-platform',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
    });

    const payload = (await response.json()) as unknown;
    const success = githubTokenSuccessResponseSchema.safeParse(payload);
    if (response.ok && success.success) {
      return success.data;
    }

    const failure = githubTokenErrorResponseSchema.safeParse(payload);
    if (failure.success) {
      if (failure.data.error === 'bad_verification_code') {
        throw new GithubCallbackError('authorization_expired');
      }
      if (
        failure.data.error === 'incorrect_client_credentials' ||
        failure.data.error === 'redirect_uri_mismatch'
      ) {
        throw new GithubCallbackError('oauth_configuration_error');
      }
    }

    throw new GithubCallbackError('connection_failed');
  }

  private async getGithubProfile(accessToken: string) {
    const response = await fetch(GithubService.USER_URL, {
      headers: this.getGithubHeaders(accessToken),
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new GithubCallbackError('connection_failed');
    }

    const payload = (await response.json()) as unknown;
    const profile = githubUserProfileSchema.safeParse(payload);
    if (!profile.success) {
      throw new GithubCallbackError('connection_failed');
    }

    return profile.data;
  }

  private async getGithubAccessToken(userId: string): Promise<string> {
    const githubConnection = await this.githubConnections.findByUserId(userId);

    if (!githubConnection) {
      throw new ConflictError(
        'User has not connected GitHub yet',
        GITHUB_ERROR_CODE.NOT_CONNECTED_GITHUB_YET,
      );
    }

    const encryptionKey = this.config.get('GITHUB_TOKEN_ENCRYPTION_KEY', {
      infer: true,
    });
    if (!encryptionKey) {
      throw new Error('GitHub token encryption key is not configured');
    }

    return decryptGithubToken(
      githubConnection.accessTokenEncrypted,
      encryptionKey,
    );
  }

  private async getListReposFromGithub(accessToken: string) {
    const repos: GithubApiRepository[] = [];
    let nextUrl: URL | null = new URL(GithubService.USER_REPOS_URL);
    nextUrl.searchParams.set('page', '1');
    nextUrl.searchParams.set('per_page', String(GITHUB_REPOS_PER_PAGE));

    while (nextUrl) {
      const response = await fetch(nextUrl.toString(), {
        headers: this.getGithubHeaders(accessToken),
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new BadRequestError(
          'Cannot get list repos from GitHub',
          GITHUB_ERROR_CODE.CANNOT_GET_LIST_REPOS_FROM_GITHUB,
        );
      }

      const payload = (await response.json()) as unknown;
      const parsedRepos = githubRepositoryListSchema.safeParse(payload);
      if (!parsedRepos.success) {
        throw new BadRequestError(
          'Cannot get list repos from GitHub',
          GITHUB_ERROR_CODE.CANNOT_GET_LIST_REPOS_FROM_GITHUB,
        );
      }

      repos.push(...parsedRepos.data);
      const nextPageUrl = this.getNextPageUrl(response.headers.get('link'));
      nextUrl = nextPageUrl ? new URL(nextPageUrl) : null;
    }

    return repos;
  }

  private async getListBranchesFromGithub(
    accessToken: string,
    owner: string,
    repo: string,
  ) {
    const branches: GithubBranch[] = [];
    let nextUrl: URL | null = new URL(
      GithubService.REPO_BRANCHES_URL + '/' + owner + '/' + repo + '/branches',
    );
    nextUrl.searchParams.set('page', '1');
    nextUrl.searchParams.set('per_page', String(GITHUB_BRANCHES_PER_PAGE));

    while (nextUrl) {
      const response = await fetch(nextUrl.toString(), {
        headers: this.getGithubHeaders(accessToken),
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new BadRequestError(
          'Cannot get list branches from GitHub',
          GITHUB_ERROR_CODE.CANNOT_GET_LIST_REPOS_FROM_GITHUB,
        );
      }

      const payload = (await response.json()) as unknown;
      const parsedBranches = githubBranchListSchema.safeParse(payload);
      if (!parsedBranches.success) {
        throw new BadRequestError(
          'Cannot get list branches from GitHub',
          GITHUB_ERROR_CODE.CANNOT_GET_LIST_REPOS_FROM_GITHUB,
        );
      }

      branches.push(...parsedBranches.data);
      const nextPageUrl = this.getNextPageUrl(response.headers.get('link'));
      nextUrl = nextPageUrl ? new URL(nextPageUrl) : null;
    }

    return branches;
  }

  private getGithubHeaders(accessToken: string) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + accessToken,
      'User-Agent': 'deploy-platform',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    };
  }

  private parseCachedRepoList(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      const parsed = githubRepoListResponseSchema.safeParse(
        JSON.parse(value) as unknown,
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private parseCachedBranchList(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      const parsed = githubBranchListResponseSchema.safeParse(
        JSON.parse(value) as unknown,
      );
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private getRepoCacheKey(userId: string) {
    return 'github:repos:' + userId;
  }

  private getBranchCacheKey(userId: string, owner: string, repo: string) {
    return 'github:branches:' + userId + ':' + owner + ':' + repo;
  }

  private getNextPageUrl(linkHeader: string | null) {
    if (!linkHeader) {
      return null;
    }

    for (const part of linkHeader.split(',')) {
      const trimmedPart = part.trim();
      const match = /^<([^>]+)>;\s*rel="([^"]+)"$/.exec(trimmedPart);
      if (match?.[2] === 'next') {
        return match[1];
      }
    }

    return null;
  }

  async resolveRepositoryById(userId: string, githubRepoId: string) {
    const repos = await this.getListRepos(userId, true);
    const repo = repos.items.find((item) => item.id === githubRepoId);

    if (!repo) {
      throw new NotFoundError('GitHub repository not found');
    }

    return repo;
  }

  async createRepositoryWebhook(userId: string, owner: string, repo: string) {
    const accessToken = await this.getGithubAccessToken(userId);
    const encryptionKey = this.config.get('GITHUB_TOKEN_ENCRYPTION_KEY', {
      infer: true,
    });
    if (!encryptionKey) {
      throw new Error('GitHub token encryption key is not configured');
    }

    const webhookSecret = randomBytes(32).toString('hex');
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        headers: {
          ...this.getGithubHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: this.getWebhookUrl(),
            content_type: 'json',
            secret: webhookSecret,
          },
        }),
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      },
    );

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new BadRequestError('Cannot create repository webhook');
    }

    const webhookId = (payload as { id?: unknown }).id;
    if (typeof webhookId !== 'number' || !Number.isInteger(webhookId)) {
      throw new BadRequestError('Cannot create repository webhook');
    }

    return {
      webhookId: String(webhookId),
      webhookSecretEncrypted: encryptGithubWebhookSecret(
        webhookSecret,
        encryptionKey,
      ),
    };
  }

  private getProjectsUrl() {
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    return new URL('/projects', frontendUrl).toString();
  }

  private getWebhookUrl() {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    const backendUrl = this.config.get('BACKEND_URL', { infer: true });
    const ngrokUrl = this.config.get('NGROK_URL', { infer: true });
    const webhookBaseUrl = nodeEnv === 'production' ? backendUrl : ngrokUrl ?? backendUrl;

    return new URL(
      '/api/v1/github/webhooks/repository',
      webhookBaseUrl,
    ).toString();
  }
}
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}



