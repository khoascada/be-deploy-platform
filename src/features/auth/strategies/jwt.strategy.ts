import { COOKIE, REDIS_KEY } from '@/common/constants';
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
    // Đọc config từ env, ví dụ JWT secret.
    config: ConfigService<EnvVars, true>,
    // Dùng Redis để check token đã bị revoke/blacklist hay chưa.
    private readonly redis: RedisService,
  ) {
    // Đăng ký cách hoạt động của strategy "jwt" cho Passport.
    super({
      // Nói cho Passport biết phải lấy JWT từ đâu trong request.
      // Ở đây token không nằm ở Authorization header mà nằm trong cookie access_token.
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessTokenFromCookie]),
      // false = nếu token đã hết hạn thì Passport tự chặn trước khi vào validate().
      ignoreExpiration: false,
      // Secret dùng để verify chữ ký JWT.
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  // Passport tự verify chữ ký và expiry trước.
  // Chỉ khi token hợp lệ thì nó mới gọi validate(payload).
  // Giá trị return ở đây sẽ được gắn vào req.user để dùng ở controller/service.
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Check thêm ở tầng ứng dụng: token có bị logout/revoke trước hạn không.
    // Key blacklist được lưu theo jti của access token.
    const blacklisted = await this.redis.exists(
      REDIS_KEY.blacklist(payload.jti),
    );

    // Nếu token đã bị revoke thì coi như không hợp lệ, dù chữ ký và expiry vẫn đúng.
    if (blacklisted) throw new UnauthorizedError('Token has been revoked');

    // Token hợp lệ -> trả payload về cho Passport/Nest gắn vào req.user.
    return payload;
  }
}
