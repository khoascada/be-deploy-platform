import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
// Guard này dùng để bảo vệ các route cần xác thực JWT. Nó sẽ check xem request có chứa JWT hợp lệ hay không, nếu không thì trả về 401 Unauthorized.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    // cái này sẽ gọi passport tìm registry 'jwt' -> jwt.strategy vì nó đã đăng ký
    // gọi canActive() của class cha (AuthGuard) để thực hiện xác thực JWT
    return super.canActivate(ctx);
  }
}
