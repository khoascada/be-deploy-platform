import { BCRYPT, REDIS_KEY, TOKEN_TTL } from '@/common/constants';
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
import { RegisterInput, type LoginInput } from './schemas/auth.schema';
import {
  RegisterResponseDto,
  AuthUserDto,
  toAuthUserDto,
  toRegisterResponseDto,
} from './dto/auth-response.dto';

interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
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
      { expiresIn: TOKEN_TTL.ACCESS },
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

  async register(data: RegisterInput): Promise<
    RegisterResponseDto & Pick<AuthSessionResult, 'accessToken' | 'refreshToken'>
  > {
    const { email, password, name, language, theme } = data;
    const exists = await this.users.findByEmail(email);

    if (exists) throw new ConflictError('Email already exists');

    const hashedPassword = await bcrypt.hash(password, BCRYPT.SALT_ROUNDS);

    const user = await this.users.create({
      email,
      passwordHash: hashedPassword,
      name,
      language,
      theme
    });

    const session = await this.createSession(user);
    return { ...toRegisterResponseDto(user), ...session };
  }

  async login(data: LoginInput): Promise<AuthSessionResult> {
    const user = await this.users.findByEmail(data.email);

    if (!user || !user.passwordHash) throw new UnauthorizedError('None user');

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedError('Not match password');

    return this.createSession(user);
  }

  async logout(
    userId: string,
    atJti: string,
    atTtlSec: number,
    refreshToken: string,
  ) {
    // Decode RT lấy jti để xóa khỏi Redis (không cần verify vì chỉ cần jti)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = this.jwt.decode(refreshToken);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const rtJti = raw && typeof raw === 'object' && 'jti' in raw ? (raw.jti as string) : null;
    if (rtJti) {
      await this.redis.del(REDIS_KEY.refreshToken(userId, rtJti));
    }

    // Blacklist AT cho đến hết TTL
    if (atTtlSec > 0) {
      await this.redis.setex(REDIS_KEY.blacklist(atJti), atTtlSec, '1');
    }
  }

  async refresh(refreshToken: string): Promise<Pick<AuthSessionResult, 'accessToken' | 'refreshToken'>> {
    let payload: { id: string; jti: string };
    try {
      payload = this.jwt.verify(refreshToken) as unknown as {
        id: string;
        jti: string;
      };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const exists = await this.redis.exists(REDIS_KEY.refreshToken(payload.id, payload.jti));
    if (!exists) throw new UnauthorizedError('Refresh token revoked');

    const user = await this.users.findById(payload.id);
    if (!user) throw new UnauthorizedError('User not found');

    // Rotation: xóa RT cũ trước khi cấp RT mới
    await this.redis.del(REDIS_KEY.refreshToken(payload.id, payload.jti));

    const { accessToken, refreshToken: newRefreshToken } =
      await this.createSession(user);

    return { accessToken, refreshToken: newRefreshToken };
  }
}

export default AuthService;
