import { ExecutionContext, createParamDecorator } from '@nestjs/common';

// Shape của user sau khi JwtAuthGuard verify token và gắn vào req.user
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  jti: string; // JWT ID — dùng để blacklist token khi logout
  exp: number;
}

// @CurrentUser() → trả toàn bộ req.user
// @CurrentUser('id') → trả req.user.id
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthUser | undefined,
    ctx: ExecutionContext,
  ): AuthUser | AuthUser[keyof AuthUser] => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = req.user;
    return data ? user?.[data] : user;
  },
);
