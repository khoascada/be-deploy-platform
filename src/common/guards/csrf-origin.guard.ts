import { ForbiddenError } from '@/common/exceptions/app.exceptions';
import { AUTH_ERROR_CODE } from '@/common/constants';
import type { EnvVars } from '@/config/env.validation';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    const origin = req.headers.origin;
    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';

    if (!origin) {
      if (isProduction) {
        throw new ForbiddenError(
          'Invalid request origin',
          AUTH_ERROR_CODE.INVALID_REQUEST_ORIGIN,
        );
      }
      return true;
    }

    const allowedOrigins = this.config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenError(
        'Invalid request origin',
        AUTH_ERROR_CODE.INVALID_REQUEST_ORIGIN,
      );
    }

    return true;
  }
}
