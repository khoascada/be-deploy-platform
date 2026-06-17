# 05 — Common Layer (Filters, Interceptors, Pipes, Guards, Decorators)

## Mục tiêu

Express cũ có `src/middlewares/` + `src/errors/` + `src/utils/response.ts`. NestJS chia nhỏ thành các tầng:

| Express cũ | NestJS | Nơi đặt |
|---|---|---|
| `error.middleware.ts` (4-arg) | **Exception Filter** | `src/common/filters/` |
| `not-found.middleware.ts` | (Nest tự xử lý) hoặc thêm filter | — |
| `validate.middleware.ts` (Zod) | **Pipe** (`ZodValidationPipe`) | `src/common/pipes/` |
| `auth.middleware.ts` (`requireAuth`) | **Guard** (`JwtAuthGuard`) | `src/auth/guards/` (xem 06) |
| `sendSuccess()` helper | **Interceptor** (`ResponseInterceptor`) | `src/common/interceptors/` |
| `request-id.middleware.ts` | **Middleware** (`NestMiddleware`) | `src/common/middleware/` (xem 04) |
| Custom `AppError` hierarchy | **HttpException subclasses** | `src/common/exceptions/` |

---

## A. Exception Filter — thay error middleware

### Express cũ

```ts
// error.middleware.ts (đơn giản hóa)
export const errorMiddleware = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, statusCode: err.statusCode },
    });
  }
  res.status(500).json({ success: false, error: { message: 'Internal error' } });
};
```

### NestJS — `AllExceptionsFilter`

`src/common/filters/all-exceptions.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()                                          // Bắt MỌI exception (không filter type)
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const r = response as Record<string, unknown>;
        message = (r.message as string) ?? message;
        code = (r.code as string) ?? deriveCodeFromStatus(status);
        details = r.details;
      }
    } else if (exception instanceof Error) {
      message = process.env.NODE_ENV === 'production' ? 'Internal server error' : exception.message;
      this.logger.error({ err: exception, url: req.url }, 'Unhandled error');
    }

    res.status(status).json({
      success: false,
      error: { code, message, statusCode: status, ...(details ? { details } : {}) },
    });
  }
}

function deriveCodeFromStatus(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'TOO_MANY_REQUESTS';
    default: return 'ERROR';
  }
}
```

### Đăng ký global

`src/main.ts`:

```ts
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';

app.useGlobalFilters(new AllExceptionsFilter());
```

Hoặc đăng ký qua provider (cho phép DI vào filter):

```ts
// src/app.module.ts
import { APP_FILTER } from '@nestjs/core';

@Module({
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
```

### Custom exceptions

Express cũ có `AppError` + 6 subclasses. NestJS có sẵn `HttpException` + subclasses (`NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `BadRequestException`, `ConflictException`, `UnprocessableEntityException`...). **Dùng luôn** thay vì tự tạo.

Nếu muốn giữ `code` field rõ ràng (giống Express cũ), wrap thêm:

`src/common/exceptions/app.exceptions.ts`:

```ts
import { HttpException, HttpStatus } from '@nestjs/common';

class CodedException extends HttpException {
  constructor(status: HttpStatus, message: string, code: string, details?: unknown) {
    super({ message, code, ...(details ? { details } : {}) }, status);
  }
}

export class NotFoundError extends CodedException {
  constructor(message = 'Resource not found') {
    super(HttpStatus.NOT_FOUND, message, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends CodedException {
  constructor(message = 'Unauthorized') {
    super(HttpStatus.UNAUTHORIZED, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends CodedException {
  constructor(message = 'Forbidden') {
    super(HttpStatus.FORBIDDEN, message, 'FORBIDDEN');
  }
}

export class ValidationError extends CodedException {
  constructor(message = 'Validation failed', details?: unknown) {
    super(HttpStatus.UNPROCESSABLE_ENTITY, message, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends CodedException {
  constructor(message = 'Conflict') {
    super(HttpStatus.CONFLICT, message, 'CONFLICT');
  }
}

export class BadRequestError extends CodedException {
  constructor(message = 'Bad request') {
    super(HttpStatus.BAD_REQUEST, message, 'BAD_REQUEST');
  }
}
```

→ Trong service vẫn viết `throw new ConflictError('Email already exists')` giống y Express cũ.

---

## B. Prisma Exception Filter — convert Prisma error → HTTP

Express cũ có `src/errors/handle-prisma-error.ts` được gọi `.catch(handlePrismaError)`. NestJS: làm thành filter riêng, sạch hơn.

`src/common/filters/prisma-exception.filter.ts`:

```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)      // Chỉ bắt loại này
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'DATABASE_ERROR';
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002':  // Unique constraint
        status = HttpStatus.CONFLICT;
        code = 'UNIQUE_CONSTRAINT';
        message = `Duplicate value for ${(exception.meta?.target as string[])?.join(', ')}`;
        break;
      case 'P2025':  // Record not found
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003':  // FK constraint
        status = HttpStatus.BAD_REQUEST;
        code = 'FOREIGN_KEY';
        message = 'Foreign key constraint failed';
        break;
    }

    res.status(status).json({
      success: false,
      error: { code, message, statusCode: status },
    });
  }
}
```

Đăng ký **trước** `AllExceptionsFilter` (filter cụ thể hơn ưu tiên hơn):

```ts
// main.ts — filter cuối cùng đăng ký sẽ chạy ĐẦU TIÊN
app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());
```

> Nestjs apply filters theo *thứ tự ngược* khi đăng ký multiple — `PrismaExceptionFilter` matches `PrismaClientKnownRequestError` cụ thể, sẽ catch trước; `AllExceptionsFilter` catch phần còn lại.

---

## C. Response Interceptor — thay `sendSuccess()`

### Express cũ

```ts
// src/utils/response.ts
export const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({ success: true, data });
};

// controller
res.status(200).json(sendSuccess(res, user));
```

### NestJS — controller chỉ return data, interceptor wrap

`src/common/interceptors/response.interceptor.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface SuccessResponse<T> {
  success: true;
  data: T;
}

@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
```

Đăng ký global (`main.ts`):

```ts
app.useGlobalInterceptors(new ResponseInterceptor());
```

→ Controller chỉ cần:

```ts
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.usersService.findById(+id);  // Trả raw object
}
// Client nhận: { success: true, data: {...} }
```

Khi throw exception, interceptor không chạy → `AllExceptionsFilter` trả `{ success: false, error: {...} }`. Format **luôn nhất quán**.

---

## D. Validation Pipe — Zod

### Cài `nestjs-zod`

```bash
npm i nestjs-zod
```

`nestjs-zod` cung cấp:
- `createZodDto(schema)` — wrap Zod schema thành DTO class (cho Swagger nhận diện)
- `ZodValidationPipe` — pipe tự động validate

### Setup global

`src/main.ts`:

```ts
import { ZodValidationPipe } from 'nestjs-zod';
app.useGlobalPipes(new ZodValidationPipe());
```

### Định nghĩa DTO + dùng trong controller

`src/auth/schemas/auth.schema.ts` (copy từ Express cũ):

```ts
import { z } from 'zod';
import { AUTH } from '@/common/constants';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
  name: z.string().min(AUTH.NAME_MIN_LENGTH).optional(),
});
```

`src/auth/dto/register.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '@/auth/schemas/auth.schema';

export class RegisterDto extends createZodDto(registerSchema) {}
```

Controller:

```ts
@Post('register')
async register(@Body() dto: RegisterDto) {
  // dto đã được Zod validate + cast. Nếu invalid → ZodValidationPipe throw
  return this.authService.register(dto);
}
```

→ Khi body sai → `ZodValidationPipe` throw → `AllExceptionsFilter` trả `{ success: false, error: { code: 'VALIDATION_ERROR', details: { fieldErrors: {...} } } }`.

---

## E. Custom Decorators

### `@Public()` — đánh dấu route không cần auth

`src/common/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Dùng trong `JwtAuthGuard` (chi tiết ở 06):

```ts
// guard
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  ctx.getHandler(),
  ctx.getClass(),
]);
if (isPublic) return true;
```

### `@CurrentUser()` — trích `req.user`

`src/common/decorators/current-user.decorator.ts`:

```ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  jti: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | unknown => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
```

Dùng trong controller:

```ts
@Get('me')
async getMe(@CurrentUser() user: AuthUser) {
  return this.usersService.findById(user.id);
}

@Get('my-id')
async getId(@CurrentUser('id') id: number) {
  return { id };
}
```

### `@Roles()` — đánh dấu role yêu cầu

`src/common/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@/common/constants';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### `RolesGuard`

`src/common/guards/roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { ForbiddenError } from '@/common/exceptions/app.exceptions';
import type { Role } from '@/common/constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenError('Insufficient role');
    }
    return true;
  }
}
```

Apply:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Delete(':id')
async delete(@Param('id') id: string) { ... }
```

---

## F. Rate limiting — `@nestjs/throttler`

### Express cũ

```ts
import rateLimit from 'express-rate-limit';
const globalLimiter = rateLimit({ ...RATE_LIMIT.GLOBAL });
app.use(globalLimiter);
// auth routes
router.use('/login', authLimiter, ...);
```

### NestJS

```ts
// app.module.ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 15 * 60 * 1000, limit: 100 },
      { name: 'auth', ttl: 15 * 60 * 1000, limit: 10 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

```ts
// auth.controller.ts
import { Throttle } from '@nestjs/throttler';

@Throttle({ auth: { ttl: 15 * 60 * 1000, limit: 10 } })
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

> Với Redis storage: `ThrottlerModule.forRootAsync({ useFactory: ... storage: new ThrottlerStorageRedisService(redis) })` (cần `@nest-lab/throttler-storage-redis`).

---

## Tóm tắt thứ tự chạy

```
Request
  ↓
1. Middleware       (RequestIdMiddleware nếu có)
  ↓
2. Guard            (JwtAuthGuard → RolesGuard → ThrottlerGuard)
  ↓
3. Interceptor      (ResponseInterceptor BEFORE — chưa làm gì)
  ↓
4. Pipe             (ZodValidationPipe trên @Body)
  ↓
5. Controller method
  ↓
6. Interceptor      (ResponseInterceptor AFTER — wrap { success, data })
  ↓
Response

Bất kỳ throw exception ở 2/3/4/5 → Exception Filter (PrismaExceptionFilter || AllExceptionsFilter)
```

## Bước tiếp theo

[06-auth-module.md](./06-auth-module.md) — JWT strategy + Passport + AuthController/Service.
