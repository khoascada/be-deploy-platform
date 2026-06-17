# 03 — Prisma Module

## Mục tiêu

Thay `src/prisma.ts` của Express (singleton client) bằng:
- `PrismaService` class **extends** `PrismaClient` — vẫn dùng được tất cả `prisma.user.*`, `prisma.$queryRaw`...
- Wrap trong `@Global() PrismaModule` — module nào cũng inject được mà không cần import lại.
- Dùng `OnModuleInit` / `OnModuleDestroy` cho lifecycle (thay `process.on('SIGTERM', ...)` thủ công).

## Code Express cũ

```ts
// src/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '@/config/env';

const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;

// src/index.ts (shutdown hook)
await prisma.$disconnect();
```

## NestJS version

### 1. `PrismaService`

`src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { EnvVars } from '@/config/env.validation';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(config: ConfigService<EnvVars, true>) {
    const pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Prisma disconnected');
  }
}
```

**Điểm cần hiểu:**

1. **`extends PrismaClient`** — instance `PrismaService` chính nó *là* PrismaClient. Trong repository viết `this.prisma.user.findMany(...)` tự nhiên.

2. **Constructor gọi `super({ adapter })`** — Prisma 7 + `@prisma/adapter-pg` cần adapter cho Postgres, giữ y nguyên pattern Express cũ.

3. **`OnModuleInit.onModuleInit()`** chạy *một lần* khi module được Nest khởi tạo. Đây là thời điểm gọi `$connect()` (tùy chọn — Prisma lazy connect khi query đầu tiên, nhưng gọi sớm để fail-fast nếu DB down).

4. **`OnModuleDestroy.onModuleDestroy()`** chạy khi app shutdown. **Cần `app.enableShutdownHooks()` trong `main.ts`** để Nest gọi hook này khi nhận SIGTERM/SIGINT.

5. **Pool cleanup** — `pg.Pool` có internal connections, gọi `pool.end()` để đóng sạch.

### 2. `PrismaModule` (global)

`src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()                         // ✓ Không cần import lại ở mọi feature module
@Module({
  providers: [PrismaService],
  exports: [PrismaService],       // ✓ Module khác inject được
})
export class PrismaModule {}
```

**`@Global()`**: bình thường provider chỉ visible trong module khai báo nó. `@Global` đăng ký vào root container — bất kỳ module nào cũng `constructor(private prisma: PrismaService)` được mà không cần `imports: [PrismaModule]`.

> **Khuyến cáo**: chỉ dùng `@Global` cho infrastructure cross-cutting (Prisma, Redis, Logger, Config). Feature module thì giữ scope rõ ràng.

### 3. Đăng ký vào `AppModule`

```ts
// src/app.module.ts
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // ...
  ],
})
export class AppModule {}
```

### 4. Inject vào Repository

```ts
// src/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(args?: { skip?: number; take?: number }) {
    return this.prisma.user.findMany({ skip: args?.skip, take: args?.take });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: { name?: string; email: string; password?: string }) {
    return this.prisma.user.create({ data });
  }
}
```

So với Express cũ (`userRepository` object literal):

| | Express | NestJS |
|---|---|---|
| Shape | Object literal `{ findAll(), findById() }` | Class `@Injectable()` |
| Prisma access | `import prisma from '@/prisma'` (singleton) | `constructor(prisma: PrismaService)` |
| Reuse trong test | Khó — phải mock module | Dễ — `Test.createTestingModule({ providers: [...] }).overrideProvider(PrismaService).useValue(mockPrisma)` |

### 5. `app.enableShutdownHooks()` — bắt buộc!

`src/main.ts`:

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();   // ✓ Nest sẽ catch SIGTERM/SIGINT và gọi onModuleDestroy
  await app.listen(3000);
}
```

Không có dòng này → khi Ctrl+C, app exit ngay không đóng pool → connection rơi rớt.

> **Lưu ý Windows**: `process.on('SIGTERM')` không bắn trên Windows console; SIGINT (Ctrl+C) thì có. NestJS `enableShutdownHooks` đã xử lý cả 2.

## Prisma error handling

Express cũ có `src/errors/handle-prisma-error.ts` dùng helper `.catch(handlePrismaError)`. Với NestJS, **chuyển sang ExceptionFilter** — chi tiết ở [05-common-layer.md](./05-common-layer.md). Repository không cần biết về HTTP code.

## Migration commands

Không khác Express:

```bash
npm run prisma:generate        # Sau khi sửa schema
npm run prisma:migrate         # Tạo migration + áp dụng
npm run prisma:studio          # GUI inspect data
```

## Bước tiếp theo

[04-redis-logger.md](./04-redis-logger.md) — RedisModule + nestjs-pino với request ID propagation.
