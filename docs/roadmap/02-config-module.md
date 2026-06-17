# 02 — Config Module (`@nestjs/config` + Zod)

## Mục tiêu

Thay thế `src/config/env.ts` của Express:

```ts
// CŨ — bootstrap import 'dotenv/config' + Zod safeParse + process.exit(1)
import 'dotenv/config';
const envSchema = z.object({ ... });
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) process.exit(1);
export const env = parsed.data;
```

bằng `ConfigModule` của NestJS — vẫn dùng Zod validate, nhưng inject `ConfigService` thay vì import singleton.

## Lý do dùng `ConfigModule` thay vì giữ singleton cũ

- **Testable**: trong test có thể override config value qua `Test.overrideProvider(ConfigService)` thay vì mock module-level.
- **Async-friendly**: provider có thể init dựa trên config (vd `JwtModule.registerAsync({ inject: [ConfigService] })`).
- **Global scope**: set `isGlobal: true` → khỏi phải `imports: [ConfigModule]` ở từng module.
- **Type-safe**: dùng `ConfigService<EnvVars, true>` (generic + strict) sẽ ép kiểu trả về.

## 1. Zod schema (giữ nguyên logic Express cũ)

`src/config/env.validation.ts`:

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export type EnvVars = z.infer<typeof envSchema>;

// `validate` callback của ConfigModule chạy 1 lần khi app bootstrap
export const validateEnv = (config: Record<string, unknown>): EnvVars => {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    // Throw để bootstrap dừng với log rõ ràng
    const errors = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment variables:\n${JSON.stringify(errors, null, 2)}`);
  }
  return parsed.data;
};
```

## 2. ConfigModule setup

`src/config/config.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,            // ✓ Khỏi import lại ở mọi module
      cache: true,                // ✓ Cache lookup → đỡ overhead
      validate: validateEnv,      // ✓ Hook validate khi load
      // envFilePath: ['.env'],   // Mặc định đã đọc .env
    }),
  ],
})
export class ConfigModule {}
```

## 3. Sử dụng trong service

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from '@/config/env.validation';

@Injectable()
export class SomeService {
  // Generic <EnvVars, true> = strict mode: get('X') sẽ ép kiểu = EnvVars['X']
  constructor(private readonly config: ConfigService<EnvVars, true>) {
    const port = this.config.get('PORT', { infer: true });           // number
    const secret = this.config.get('JWT_SECRET', { infer: true });   // string
  }
}
```

> **Mẹo type-safe**: `{ infer: true }` cần để TypeScript suy kiểu từ generic. Không có thì `get()` trả `string | undefined`.

## 4. Dùng config khi đăng ký module động

Đây là điểm `ConfigService` mạnh hơn singleton cũ — module phụ thuộc config phải `registerAsync`:

```ts
// auth.module.ts
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }) },
      }),
    }),
  ],
})
export class AuthModule {}
```

So sánh Express cũ:

```ts
// CŨ — auth.service.ts
import { env } from '@/config/env';
jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL.ACCESS });
```

→ NestJS: bạn không gọi `jwt.sign` trực tiếp, mà inject `JwtService.sign(payload)` (JwtModule đã config sẵn secret).

## 5. Đăng ký vào `AppModule`

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@/config/config.module';

@Module({
  imports: [
    ConfigModule,
    // ... other modules
  ],
})
export class AppModule {}
```

## 6. Constants

Express cũ có `src/constants/index.ts` chứa `TOKEN_TTL`, `REDIS_KEY`, `ROLES`, `AUTH`, `BCRYPT`, `RATE_LIMIT`. **Giữ nguyên** — đây là pure constants không cần DI.

Đặt vào `src/common/constants/`:

```ts
// src/common/constants/index.ts
export const TOKEN_TTL = {
  ACCESS: 15 * 60,        // 15 minutes (seconds)
  REFRESH: 7 * 24 * 3600, // 7 days
} as const;

export const REDIS_KEY = {
  refreshToken: (userId: number, jti: string) => `rt:${userId}:${jti}`,
  blacklist: (jti: string) => `bl:${jti}`,
} as const;

export const ROLES = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const AUTH = {
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  BEARER_PREFIX: 'Bearer ',
} as const;

export const BCRYPT = { SALT_ROUNDS: 10 } as const;
```

## So sánh nhanh

| | Express cũ | NestJS |
|---|---|---|
| Load env | `import 'dotenv/config'` ở top file | `ConfigModule.forRoot()` |
| Validate | Zod `safeParse` + `process.exit(1)` | Zod trong `validate` callback, throw → Nest log + exit |
| Đọc value | `env.JWT_SECRET` (singleton) | `config.get('JWT_SECRET', { infer: true })` (DI) |
| Scope | Module-global singleton | Có thể override trong test |
| Async init | Không có | `registerAsync({ inject, useFactory })` |

## Bước tiếp theo

[03-prisma-module.md](./03-prisma-module.md) — `PrismaService` extends `PrismaClient` + lifecycle hooks.
