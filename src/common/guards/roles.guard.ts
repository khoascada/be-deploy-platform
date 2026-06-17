import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { ForbiddenError } from '@/common/exceptions/app.exceptions';
import type { Role } from '@/common/constants';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Đọc roles được khai báo qua @Roles() trên method hoặc class
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Không có @Roles() → không yêu cầu role cụ thể → cho qua
    if (!required || required.length === 0) return true;

    // req.user được gắn bởi JwtAuthGuard
    const { user } = ctx.switchToHttp().getRequest<{ user: { role: Role } }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenError('Insufficient role');
    }

    return true;
  }
}
