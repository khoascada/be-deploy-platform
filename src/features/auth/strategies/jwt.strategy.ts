import { REDIS_KEY } from '@/common/constants';
import { UnauthorizedError } from '@/common/exceptions/app.exceptions';
import type { EnvVars } from '@/config/env.validation';
import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  id: number;
  email: string;
  role: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvVars, true>,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  // Passport tự verify chữ ký + expiry trước khi gọi validate()
  // validate() chỉ check blacklist và trả về payload → gắn vào req.user
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const blacklisted = await this.redis.exists(
      REDIS_KEY.blacklist(payload.jti),
    );

    if (blacklisted) throw new UnauthorizedError('Token has been revoked');
    return payload;
  }
}
