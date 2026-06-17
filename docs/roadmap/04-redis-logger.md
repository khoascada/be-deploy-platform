# 04 — Redis & Logger

## Mục tiêu

- `RedisModule` (global) + `RedisService` wrap `ioredis`
- `LoggerModule` dùng `nestjs-pino` — replace `pino-http` + custom logger Express cũ
- Correlation ID (request ID) tự động chèn vào mọi log của 1 request

---

## A. RedisModule

### Express cũ

```ts
// src/config/redis.ts
import Redis from 'ioredis';
import { env } from '@/config/env';

const redis = new Redis(env.REDIS_URL, { lazyConnect: true });
redis.on('error', (e) => logger.error(e, 'redis error'));
redis.on('connect', () => logger.info('redis connected'));

export default redis;

// src/index.ts
await redis.connect();
// ... shutdown
await redis.quit();
```

### NestJS version

`src/redis/redis.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { EnvVars } from '@/config/env.validation';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;       // expose nếu cần raw API

  constructor(config: ConfigService<EnvVars, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    this.client.on('error', (e) => this.logger.error(e, 'Redis error'));
    this.client.on('connect', () => this.logger.log('Redis connected'));
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ---- Wrapper methods cho convenience + type-safe ----

  setex(key: string, ttlSec: number, value: string) {
    return this.client.setex(key, ttlSec, value);
  }

  get(key: string) {
    return this.client.get(key);
  }

  del(key: string) {
    return this.client.del(key);
  }

  exists(key: string) {
    return this.client.exists(key);
  }

  ping() {
    return this.client.ping();    // dùng cho health check
  }
}
```

`src/redis/redis.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

### Dùng trong AuthService

So sánh:

```ts
// CŨ — auth.service.ts (top-level import)
import redis from '@/config/redis';
await redis.setex(REDIS_KEY.refreshToken(user.id, jti), TOKEN_TTL.REFRESH, '1');

// MỚI — auth.service.ts (constructor inject)
constructor(private readonly redis: RedisService) {}
// ...
await this.redis.setex(REDIS_KEY.refreshToken(user.id, jti), TOKEN_TTL.REFRESH, '1');
```

---

## B. Logger (`nestjs-pino`)

### Tại sao `nestjs-pino` thay vì tự `pino` + `pino-http`?

- Tự động bind `Logger` của Nest (cả internal logger framework dùng) vào pino → 1 stream nhất quán
- Built-in HTTP middleware (đã có `pino-http` bên trong)
- Tự sinh `req.id` (UUID) — *hoặc* dùng request ID bạn đã chèn từ middleware riêng
- API quen thuộc: `constructor(@InjectPinoLogger(MyService.name) private logger: PinoLogger)` hoặc `this.logger.log(...)`

### Setup

`src/logger/logger.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { EnvVars } from '@/config/env.validation';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        pinoHttp: {
          // Pretty trong dev, JSON trong prod
          transport:
            config.get('NODE_ENV', { infer: true }) !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,

          // Redact thông tin nhạy cảm (giống Express cũ)
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              '*.password',
              '*.token',
              '*.refreshToken',
            ],
            censor: '[REDACTED]',
          },

          // Reuse X-Request-Id từ header hoặc tự generate
          genReqId: (req, res) => {
            const existing = (req.headers['x-request-id'] as string) || randomUUID();
            res.setHeader('X-Request-Id', existing);
            return existing;
          },

          // Serializer gọn nhẹ
          serializers: {
            req: (req) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode }),
          },

          customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
```

### Đăng ký vào AppModule + main.ts

```ts
// src/app.module.ts
@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, RedisModule /* ... */],
})
export class AppModule {}
```

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));   // ✓ Replace Nest's default ConsoleLogger với pino
  app.enableShutdownHooks();
  await app.listen(3000);
}
bootstrap();
```

`bufferLogs: true` cho phép Nest buffer log của giai đoạn bootstrap và flush sau khi `useLogger` được gọi — tránh log trùng giai đoạn init.

### Dùng trong service

Có 2 cách:

**1. `Logger` từ `@nestjs/common`** — đơn giản, gọn:

```ts
import { Logger } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async getById(id: number) {
    this.logger.log({ userId: id }, 'fetching user');   // → pino
  }
}
```

**2. `PinoLogger` từ `nestjs-pino`** — control nhiều hơn:

```ts
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class UsersService {
  constructor(@InjectPinoLogger(UsersService.name) private readonly logger: PinoLogger) {}
}
```

Cả 2 đều xuất ra pino, đều có `requestId` của request hiện tại (nhờ `nestjs-pino` chạy mỗi request trong async context).

### Correlation ID — không cần AsyncLocalStorage thủ công

Express cũ phải tự setup `AsyncLocalStorage` trong `src/utils/context.ts` để inject `requestId` vào mọi log. **`nestjs-pino` đã làm sẵn**:

- Mỗi request được wrap trong async context của `pino-http`
- Mọi `this.logger.log(...)` trong service được gọi từ request handler → tự động kèm `req.id`

→ Bỏ luôn `src/utils/context.ts`.

---

## C. Request ID middleware (vẫn cần)

Vẫn nên có middleware riêng để **set request ID vào `res.header`** cho client thấy. `nestjs-pino` set vào pino context nhưng không tự set vào response header (đã xử lý ở `genReqId` ở trên — thì đủ rồi).

Nếu muốn tách rời thành middleware riêng (giống Express cũ `src/middlewares/request-id.middleware.ts`):

`src/common/middleware/request-id.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    (req as any).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}
```

Apply trong `AppModule`:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from '@/common/middleware/request-id.middleware';

@Module({ /* ... */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

**Lưu ý**: thứ tự — `RequestIdMiddleware` chạy *trước* `nestjs-pino` middleware là không thể (NestJS module-level middleware vs Express middleware order). Đơn giản nhất: để `nestjs-pino` `genReqId` xử lý cả 2 việc (set context + response header).

---

## So sánh tổng thể

| | Express cũ | NestJS |
|---|---|---|
| Redis client | Singleton `import redis from '@/config/redis'` | `RedisService` inject qua constructor |
| Redis connect | `await redis.connect()` trong `start()` | `OnModuleInit.onModuleInit()` |
| Redis disconnect | `await redis.quit()` trong shutdown | `OnModuleDestroy.onModuleDestroy()` |
| Logger | Singleton pino + `pino-http` middleware | `nestjs-pino` LoggerModule |
| Request ID | Custom middleware + AsyncLocalStorage | `nestjs-pino` `genReqId` (auto) |
| Redaction | Manual config | Cùng options, đặt trong `forRootAsync` |
| Logger trong service | `import logger from '@/config/logger'` | `new Logger(name)` hoặc `@InjectPinoLogger` |

## Bước tiếp theo

[05-common-layer.md](./05-common-layer.md) — Exception filters, interceptors, guards, custom decorators thay middleware Express.
