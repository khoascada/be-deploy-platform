import { BCRYPT, REDIS_KEY, TOKEN_TTL } from '@/common/constants';
import {
  ConflictError,
  UnauthorizedError,
} from '@/common/exceptions/app.exceptions';
import { UsersRepository } from '@/features/users/user.repository';
import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RegisterInput, type LoginInput } from './schemas/auth.schema';
import {
  LoginResponseDto,
  RegisterResponseDto,
  TokensDto,
  toAuthUserDto,
  toRegisterResponseDto,
} from './dto/auth-response.dto';

@Injectable()
class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
  ) {}

  private signAccessToken(payload: {
    id: number;
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

  private signRefreshToken(payload: { id: number }) {
    const jti = randomUUID();
    const token = this.jwt.sign(
      { ...payload, jti },
      { expiresIn: TOKEN_TTL.REFRESH },
    );
    return { token, jti };
  }

  async register(data: RegisterInput): Promise<RegisterResponseDto> {
    const { email, password, name, age, address } = data;
    const exists = await this.users.findByEmail(email);

    if (exists) throw new ConflictError('Email already exists');

    const hashedPassword = await bcrypt.hash(password, BCRYPT.SALT_ROUNDS);

    const user = await this.users.create({
      email,
      password: hashedPassword,
      name,
      age,
      address,
    });

    return toRegisterResponseDto(user);
  }

  async login(data: LoginInput): Promise<LoginResponseDto> {
    const user = await this.users.findByEmail(data.email);

    if (!user || !user.password) throw new UnauthorizedError('None user');

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) throw new UnauthorizedError('Not match password');

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

  async logout(userId: number, atJti: string, atTtlSec: number, refreshToken: string) {
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

  async refresh(refreshToken: string): Promise<TokensDto> {
    let payload: { id: number; jti: string };
    try {
      payload = this.jwt.verify(refreshToken) as unknown as { id: number; jti: string };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const exists = await this.redis.exists(REDIS_KEY.refreshToken(payload.id, payload.jti));
    if (!exists) throw new UnauthorizedError('Refresh token revoked');

    const user = await this.users.findById(payload.id);
    if (!user) throw new UnauthorizedError('User not found');

    // Rotation: xóa RT cũ trước khi cấp RT mới
    await this.redis.del(REDIS_KEY.refreshToken(payload.id, payload.jti));

    const { token: newAccessToken } = this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const { token: newRefreshToken, jti: newJti } = this.signRefreshToken({ id: user.id });

    await this.redis.setex(REDIS_KEY.refreshToken(user.id, newJti), TOKEN_TTL.REFRESH, '1');

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}

export default AuthService;
