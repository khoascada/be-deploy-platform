import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import type { Role } from '@/common/constants';
import { AUTH_ERROR_CODE } from '@/common/constants';
import { ForbiddenError } from '@/common/exceptions/app.exceptions';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user: { role: Role } }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenError(
        'Insufficient role',
        AUTH_ERROR_CODE.INSUFFICIENT_ROLE,
      );
    }

    return true;
  }
}
