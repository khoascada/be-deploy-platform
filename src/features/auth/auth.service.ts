import {
  AUTH_ERROR_CODE,
  BCRYPT,
  REDIS_KEY,
  TOKEN_TTL,
  USER_ERROR_CODE,
} from '@/common/constants';
import {
  ConflictError,
  UnauthorizedError,
} from '@/common/exceptions/app.exceptions';
import { UsersRepository } from '@/features/users/user.repository';
import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  AuthUserDto,
  RegisterResponseDto,
  toAuthUserDto,
  toRegisterResponseDto,
} from './dto/auth-response.dto';
import { RegisterInput, type LoginInput } from './schemas/auth.schema';

interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

function extractJti(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('jti' in payload)) {
    return null;
  }

  const { jti } = payload as { jti?: unknown };
  return typeof jti === 'string' ? jti : null;
}

@Injectable()
class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  private signAccessToken(payload: {
    id: string;
    email: string;
    role: string;
  }) {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { ...payload, jti },
      { expiresIn: TOKEN_TTL.ACCESS }, // jwt sẽ tự sinh ra iat, exp
    );
    return { token, jti };
  }

  private signRefreshToken(payload: { id: string }) {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { ...payload, jti },
      { expiresIn: TOKEN_TTL.REFRESH },
    );
    return { token, jti };
  }

  private async createSession(user: User): Promise<AuthSessionResult> {
    const { token: accessToken } = this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const { token: refreshToken, jti: rtJti } = this.signRefreshToken({
      id: user.id,
    });

    await this.redis.setex(
      REDIS_KEY.refreshToken(user.id, rtJti),
      TOKEN_TTL.REFRESH,
      '1',
    );

    return { accessToken, refreshToken, user: toAuthUserDto(user) };
  }

  async register(
    data: RegisterInput,
  ): Promise<
    RegisterResponseDto &
      Pick<AuthSessionResult, 'accessToken' | 'refreshToken'>
  > {
    const { email, password, name, language, theme } = data;
    const exists = await this.users.findByEmail(email);

    if (exists) {
      throw new ConflictError(
        'Email already exists',
        AUTH_ERROR_CODE.EMAIL_ALREADY_EXISTS,
      );
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT.SALT_ROUNDS);

    const user = await this.users.create({
      email,
      passwordHash: hashedPassword,
      name,
      language,
      theme,
    });

    const session = await this.createSession(user);
    return { ...toRegisterResponseDto(user), ...session };
  }

  async login(data: LoginInput): Promise<AuthSessionResult> {
    const user = await this.users.findByEmail(data.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError(
        'Invalid credentials',
        AUTH_ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError(
        'Invalid credentials',
        AUTH_ERROR_CODE.INVALID_CREDENTIALS,
      );
    }

    return this.createSession(user);
  }

  async logout(
    userId: string,
    atJti: string,
    atTtlSec: number,
    refreshToken: string,
  ) {
    const rtJti = extractJti(this.jwt.decode(refreshToken));
    if (rtJti) {
      await this.redis.del(REDIS_KEY.refreshToken(userId, rtJti));
    }

    if (atTtlSec > 0) {
      await this.redis.setex(REDIS_KEY.blacklist(atJti), atTtlSec, '1');
    }
  }

  async refresh(
    refreshToken: string,
  ): Promise<Pick<AuthSessionResult, 'accessToken' | 'refreshToken'>> {
    let payload: { id: string; jti: string };
    try {
      payload = this.jwt.verify(refreshToken) as unknown as {
        id: string;
        jti: string;
      };
    } catch {
      throw new UnauthorizedError(
        'Invalid refresh token',
        AUTH_ERROR_CODE.INVALID_REFRESH_TOKEN,
      );
    }

    const exists = await this.redis.exists(
      REDIS_KEY.refreshToken(payload.id, payload.jti),
    );
    if (!exists) {
      throw new UnauthorizedError(
        'Refresh token revoked',
        AUTH_ERROR_CODE.REFRESH_TOKEN_REVOKED,
      );
    }

    const user = await this.users.findById(payload.id);
    if (!user) {
      throw new UnauthorizedError(
        'User not found',
        USER_ERROR_CODE.USER_NOT_FOUND,
      );
    }

    await this.redis.del(REDIS_KEY.refreshToken(payload.id, payload.jti));

    const { accessToken, refreshToken: newRefreshToken } =
      await this.createSession(user);

    return { accessToken, refreshToken: newRefreshToken };
  }
}

export default AuthService;
