import { AUTH_ERROR_CODE, COOKIE, REDIS_KEY } from '@/common/constants';
import { UnauthorizedError } from '@/common/exceptions/app.exceptions';
import { getCookieValue } from '@/common/utils/cookie.util';
import type { EnvVars } from '@/config/env.validation';
import { RedisService } from '@/redis/redis.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type JwtFromRequestFunction } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  jti: string;
  exp?: number;
}

const extractAccessTokenFromCookie: JwtFromRequestFunction = (
  req: Request | undefined,
) => getCookieValue(req, COOKIE.ACCESS_TOKEN) ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<EnvVars, true>,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const blacklisted = await this.redis.exists(
      REDIS_KEY.blacklist(payload.jti),
    );

    if (blacklisted) {
      throw new UnauthorizedError(
        'Token has been revoked',
        AUTH_ERROR_CODE.TOKEN_REVOKED,
      );
    }

    return payload;
  }
}
