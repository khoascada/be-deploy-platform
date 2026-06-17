# 06 — Auth Module (`@nestjs/passport` + JWT)

## Mục tiêu

Port nguyên xi flow Auth từ Express:
- `register`, `login`, `refresh-token`, `logout`
- Access token + Refresh token (JWT, có `jti`)
- Refresh token lưu Redis với TTL → revoke được, rotation khi refresh
- Access token blacklist trong Redis khi logout
- `requireAuth` middleware → **JwtAuthGuard** (Passport strategy)

## Vì sao dùng `@nestjs/passport`?

- Tách logic verify token sang **strategy class** (`JwtStrategy`) — testable, reusable
- Tự handle `Bearer ...` header parsing
- Dễ thêm strategies khác (local, OAuth, API key) cùng một guard infrastructure
- Convention nhất quán với cộng đồng NestJS

## 1. Cấu trúc folder

```
src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   └── jwt.strategy.ts
├── guards/
│   └── jwt-auth.guard.ts
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── refresh-token.dto.ts
│   └── logout.dto.ts
└── schemas/
    └── auth.schema.ts        # Zod schemas (copy từ Express)
```

## 2. Zod schemas

`src/auth/schemas/auth.schema.ts` (giữ y nguyên Express):

```ts
import { z } from 'zod';
import { AUTH } from '@/common/constants';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
  name: z.string().min(AUTH.NAME_MIN_LENGTH).optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const logoutSchema = z.object({
  refreshToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

## 3. DTOs

`src/auth/dto/register.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '@/auth/schemas/auth.schema';

export class RegisterDto extends createZodDto(registerSchema) {}
```

Tương tự cho `LoginDto`, `RefreshTokenDto`, `LogoutDto`.

> `createZodDto` không chỉ validate mà còn cho `@nestjs/swagger` đọc schema → auto generate OpenAPI request body — xem [08-health-swagger.md](./08-health-swagger.md).

## 4. JWT Strategy

`src/auth/strategies/jwt.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvVars } from '@/config/env.validation';
import { REDIS_KEY } from '@/common/constants';
import { RedisService } from '@/redis/redis.service';
import { UnauthorizedError } from '@/common/exceptions/app.exceptions';

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
  // Tại đây ta check blacklist và trả về user object (gắn vào req.user)
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const blacklisted = await this.redis.exists(REDIS_KEY.blacklist(payload.jti));
    if (blacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }
    return payload;   // req.user = payload
  }
}
```

**Lưu ý:**

- `PassportStrategy(Strategy, 'jwt')` — `'jwt'` là *strategy name* dùng trong `AuthGuard('jwt')`.
- `validate()` trả gì → `req.user` = giá trị đó. Trả `null/false/throw` → 401.
- Trong Express cũ, `requireAuth` decode + verify + check blacklist + gắn `req.user` thủ công. NestJS chia: **Passport** verify, **strategy.validate** check blacklist, **guard** orchestrate.

## 5. JwtAuthGuard

`src/auth/guards/jwt-auth.guard.ts`:

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Skip nếu route được đánh dấu @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### Đăng ký GLOBAL (mặc định protected)

Express cũ mount `requireAuth` chỉ ở `/users`. Cách hay hơn trong NestJS: **default-protect tất cả**, route public phải đánh dấu `@Public()`. An toàn hơn (forget-to-protect không xảy ra).

```ts
// app.module.ts
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';

@Module({
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
```

Sau đó:

```ts
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) { ... }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) { ... }
}

@Controller('users')
// Không cần @UseGuards — global guard đã bật
export class UsersController {
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) { ... }
}
```

> Nếu thích "opt-in protection" như Express cũ, bỏ `APP_GUARD` global và dùng `@UseGuards(JwtAuthGuard)` ở từng controller.

## 6. AuthService — port logic

`src/auth/auth.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { BCRYPT, REDIS_KEY, ROLES, TOKEN_TTL } from '@/common/constants';
import { ConflictError, UnauthorizedError } from '@/common/exceptions/app.exceptions';
import { RedisService } from '@/redis/redis.service';
import { UsersRepository } from '@/users/users.repository';
import type { RegisterInput, LoginInput } from './schemas/auth.schema';
import type { EnvVars } from '@/config/env.validation';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  private signAccessToken(payload: { id: number; email: string; role: string }) {
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

  async register(data: RegisterInput) {
    const existing = await this.users.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already exists');

    const hashedPassword = await bcrypt.hash(data.password, BCRYPT.SALT_ROUNDS);
    const user = await this.users.create({
      email: data.email,
      name: data.name,
      password: hashedPassword,
    });

    return this.toPublicUser(user);
  }

  async login(data: LoginInput) {
    const user = await this.users.findByEmail(data.email);
    if (!user || !user.password) throw new UnauthorizedError('Invalid credentials');

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) throw new UnauthorizedError('Invalid credentials');

    const { token: accessToken } = this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role ?? ROLES.USER,
    });
    const { token: refreshToken, jti: rtJti } = this.signRefreshToken({ id: user.id });

    await this.redis.setex(
      REDIS_KEY.refreshToken(user.id, rtJti),
      TOKEN_TTL.REFRESH,
      '1',
    );

    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  async logout(userId: number, atJti: string, atTtlSec: number, refreshToken: string) {
    // Decode RT để lấy jti — không verify (chỉ cần jti xóa khỏi Redis)
    const decoded = this.jwt.decode(refreshToken) as { jti?: string } | null;
    if (decoded?.jti) {
      await this.redis.del(REDIS_KEY.refreshToken(userId, decoded.jti));
    }

    if (atTtlSec > 0) {
      await this.redis.setex(REDIS_KEY.blacklist(atJti), atTtlSec, '1');
    }
  }

  async refresh(refreshToken: string) {
    let payload: { id: number; jti: string };
    try {
      payload = this.jwt.verify(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const exists = await this.redis.exists(REDIS_KEY.refreshToken(payload.id, payload.jti));
    if (!exists) throw new UnauthorizedError('Refresh token revoked');

    const user = await this.users.findById(payload.id);
    if (!user) throw new UnauthorizedError('User not found');

    // Rotation: xóa RT cũ
    await this.redis.del(REDIS_KEY.refreshToken(payload.id, payload.jti));

    const { token: newAccessToken } = this.signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const { token: newRefreshToken, jti: newJti } = this.signRefreshToken({ id: user.id });

    await this.redis.setex(
      REDIS_KEY.refreshToken(user.id, newJti),
      TOKEN_TTL.REFRESH,
      '1',
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  private toPublicUser(user: { id: number; email: string; name: string | null; role: string }) {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
```

**So sánh:** logic giống y file Express cũ, chỉ khác là:
- `import { env } from '@/config/env'` → inject `ConfigService`
- `import redis from '@/config/redis'` → inject `RedisService`
- `jwt.sign(payload, env.JWT_SECRET, {...})` → `this.jwt.sign(payload, {...})` (JwtModule đã set secret)
- `import { userRepository }` → inject `UsersRepository`

## 7. AuthController

`src/auth/auth.controller.ts`:

```ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Logout YÊU CẦU auth — global JwtAuthGuard chặn nếu không có token
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    // TTL còn lại của access token = exp - now (cần extract exp từ JWT)
    // Đơn giản hóa: dùng TOKEN_TTL.ACCESS làm worst case
    const atTtlSec = TOKEN_TTL.ACCESS;
    await this.auth.logout(user.id, user.jti, atTtlSec, dto.refreshToken);
  }
}
```

> **Cải tiến**: tính `atTtlSec` chính xác bằng cách trích `exp` từ payload. Có thể extend `JwtPayload` thêm `exp: number` và truyền sang.

## 8. AuthModule

`src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '@/users/users.module';
import type { EnvVars } from '@/config/env.validation';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        // signOptions mặc định — expiresIn được set per call trong AuthService
      }),
    }),
    UsersModule,    // ✓ Để inject UsersRepository — UsersModule phải exports nó
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

## 9. Đăng ký vào AppModule

```ts
// app.module.ts
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    // ...
  ],
})
export class AppModule {}
```

## Flow tổng kết

### Register
```
POST /auth/register { email, password, name }
  → @Public() → bypass JwtAuthGuard
  → ZodValidationPipe (RegisterDto)
  → AuthController.register()
  → AuthService.register()
    → UsersRepository.findByEmail()  → null
    → bcrypt.hash(password)
    → UsersRepository.create()
  → ResponseInterceptor wraps
  → 201 { success: true, data: { id, email, name, role } }
```

### Login
```
POST /auth/login { email, password }
  → @Public()
  → AuthService.login()
    → bcrypt.compare()
    → signAccessToken() → { token, jti } (15min)
    → signRefreshToken() → { token, jti } (7day)
    → redis.setex(rt:userId:jti, 7day)
  → 200 { success: true, data: { accessToken, refreshToken, user } }
```

### Authenticated request
```
GET /users/me  Authorization: Bearer <AT>
  → JwtAuthGuard.canActivate()
    → !isPublic → super.canActivate()
    → JwtStrategy.validate(payload)
      → redis.exists(bl:jti) → false
      → return payload
    → req.user = payload
  → UsersController.getMe(@CurrentUser() user)
  → ResponseInterceptor
  → 200 { success: true, data: {...} }
```

### Refresh
```
POST /auth/refresh-token { refreshToken }
  → @Public()
  → AuthService.refresh()
    → jwt.verify(RT)
    → redis.exists(rt:id:jti) → true
    → redis.del(rt:id:jti)          // rotation
    → sign new AT + RT
    → redis.setex(rt:id:newJti)
  → 200 { success: true, data: { accessToken, refreshToken } }
```

### Logout
```
POST /auth/logout { refreshToken }   Authorization: Bearer <AT>
  → JwtAuthGuard (cần auth)
  → AuthService.logout(user.id, user.jti, atTtl, RT)
    → decode RT → rtJti
    → redis.del(rt:userId:rtJti)
    → redis.setex(bl:atJti, atTtl)
  → 204 No Content
```

## Bước tiếp theo

[07-feature-modules.md](./07-feature-modules.md) — `UsersModule`, `ProductsModule` pattern.
