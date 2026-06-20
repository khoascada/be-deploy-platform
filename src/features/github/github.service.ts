import type { EnvVars } from '@/config/env.validation';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { RedisService } from '../../redis/redis.service';
import { encryptGithubToken } from './github-token-cipher';
import { GithubRepository } from './github.repository';
import {
  githubCallbackQuerySchema,
  githubOAuthStateSchema,
  githubTokenErrorResponseSchema,
  githubTokenSuccessResponseSchema,
  githubUserProfileSchema,
} from './schemas/github.schema';

const OAUTH_STATE_TTL_SECONDS = 300;
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;

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

  private readonly logger = new Logger(GithubService.name);

  constructor(
    private readonly config: ConfigService<EnvVars, true>,
    private readonly redis: RedisService,
    private readonly githubConnections: GithubRepository,
  ) {}

  // Tạo state và PKCE, lưu chúng vào Redis rồi build URL authorize của GitHub.
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

  // Điều phối toàn bộ callback: verify state, lấy GitHub user, tạo connection và build URL về FE.
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
      // Lỗi OAuth đã biết dùng reason an toàn; lỗi ngoài dự kiến được gom về mã chung.
      const reason =
        error instanceof GithubCallbackError
          ? error.reason
          : 'connection_failed';

      // Chỉ log tên loại lỗi ngoài dự kiến, không log token, code hoặc raw response.
      if (!(error instanceof GithubCallbackError)) {
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        this.logger.error('GitHub OAuth callback failed with ' + errorName);
      }

      // Redirect về URL FE cố định và truyền safe reason để FE hiển thị thông báo phù hợp.
      const errorUrl = new URL(projectsUrl);
      errorUrl.searchParams.set('connectGithub', 'error');
      errorUrl.searchParams.set('reason', reason);

      return {
        statusCode: HttpStatus.FOUND,
        url: errorUrl.toString(),
      };
    }
  }

  // Lấy và xóa state atomically để callback hợp lệ cũng chỉ được sử dụng đúng một lần.
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

  // Đổi authorization code cùng PKCE verifier lấy access token từ GitHub.
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

  // Dùng access token gọi /user và validate profile trước khi tin tưởng dữ liệu GitHub.
  private async getGithubProfile(accessToken: string) {
    const response = await fetch(GithubService.USER_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + accessToken,
        'User-Agent': 'deploy-platform',
        'X-GitHub-Api-Version': '2022-11-28',
      },
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

  // Tạo redirect cố định từ FRONTEND_URL để không phát sinh open redirect từ input bên ngoài.
  private getProjectsUrl() {
    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    return new URL('/projects', frontendUrl).toString();
  }
}

// Nhận diện Prisma P2002 để biến race-condition duplicate thành lỗi an toàn cho callback.
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
