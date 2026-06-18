import { ForbiddenError } from '@/common/exceptions/app.exceptions';
import type { EnvVars } from '@/config/env.validation';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
// cái này để chặn các request ghi dữ liệu (POST/PUT/DELETE) mà origin không nằm trong allowlist, nhằm giảm rủi ro CSRF/cross-origin request ngoài ý muốn.
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvVars, true>) {}

  canActivate(context: ExecutionContext): boolean {
    // Chỉ áp dụng cho HTTP request.
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest<Request>();
    // Request chỉ đọc dữ liệu thì bỏ qua; tập trung kiểm tra các method có thể đổi state.
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;

    const origin = req.headers.origin;
    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';

    // Ở production, request ghi dữ liệu mà không có Origin sẽ bị từ chối.
    // Ở development thì nới lỏng để tiện test bằng Postman/cURL.
    if (!origin) {
      if (isProduction) throw new ForbiddenError('Invalid request origin');
      return true;
    }

    // Cho phép nhiều origin, phân tách bằng dấu phẩy trong biến CORS_ORIGIN.
    const allowedOrigins = this.config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    // Nếu Origin không nằm trong allowlist thì chặn request.
    // Mục đích là giảm rủi ro CSRF/cross-origin request ngoài ý muốn.
    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenError('Invalid request origin');
    }

    return true;
  }
}
