# 07 — Feature Modules (`UsersModule`, `ProductsModule`)

## Mục tiêu

Port pattern Controller → Service → Repository từ Express sang NestJS, đặt thành **feature module**. Lấy `Users` làm example chi tiết, `Products` là skeleton tương tự.

---

## A. UsersModule

### Cấu trúc

```
src/users/
├── users.module.ts
├── users.controller.ts
├── users.service.ts
├── users.repository.ts
├── dto/
│   ├── user.dto.ts           # Output shape (filter password)
│   ├── update-user.dto.ts
│   └── pagination.dto.ts     # Query params
└── schemas/
    └── user.schema.ts        # Zod
```

### 1. Zod schemas + DTOs

`src/users/schemas/user.schema.ts`:

```ts
import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.email().optional(),
  age: z.number().int().positive().optional(),
  address: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

`src/users/dto/update-user.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { updateUserSchema } from '@/users/schemas/user.schema';

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
```

`src/users/dto/pagination.dto.ts`:

```ts
import { createZodDto } from 'nestjs-zod';
import { paginationSchema } from '@/users/schemas/user.schema';

export class PaginationDto extends createZodDto(paginationSchema) {}
```

### 2. Repository

`src/users/users.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(args: { skip: number; take: number }) {
    return this.prisma.user.findMany({
      skip: args.skip,
      take: args.take,
      orderBy: { id: 'desc' },
    });
  }

  count() {
    return this.prisma.user.count();
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

  create(data: { name?: string; email: string; password?: string; age?: number; address?: string }) {
    return this.prisma.user.create({ data });
  }

  update(id: number, data: { name?: string; email?: string; age?: number; address?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }
}
```

**Khác Express cũ:**
- Object literal → `@Injectable()` class
- `import prisma from '@/prisma'` → `constructor(prisma: PrismaService)`
- Bỏ `.catch(handlePrismaError)` — `PrismaExceptionFilter` (xem 05) bắt toàn cục

### 3. Service

`src/users/users.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { NotFoundError } from '@/common/exceptions/app.exceptions';
import type { PaginationDto } from './dto/pagination.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async findAll(pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.users.findAll({ skip, take: pagination.limit }),
      this.users.count(),
    ]);
    return {
      items: items.map(toPublicUser),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async findById(id: number) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(`User #${id} not found`);
    return toPublicUser(user);
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findById(id);          // tận dụng throw NotFoundError nếu không tồn tại
    const updated = await this.users.update(id, dto);
    return toPublicUser(updated);
  }

  async remove(id: number) {
    await this.findById(id);
    await this.users.delete(id);
  }
}

function toPublicUser<T extends { id: number; email: string; name: string | null; role: string }>(
  user: T,
) {
  // Filter password, etc.
  const { password: _, ...rest } = user as T & { password?: string };
  return rest;
}
```

### 4. Controller

`src/users/users.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from './dto/pagination.dto';
import { CurrentUser, AuthUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';

@Controller('users')
@UseGuards(RolesGuard)             // JwtAuthGuard đã global, chỉ cần thêm Roles
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  @Roles('ADMIN')
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.users.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.users.remove(id);
  }
}
```

**Decorator quan trọng:**

- `@Param('id', ParseIntPipe)` — pipe built-in convert `'123'` → `123`, throw 400 nếu không phải số
- `@Query()` — bind toàn bộ query string → DTO
- `@Body()` — bind request body → DTO
- `@HttpCode(204)` — override default status (POST=201, others=200)

### 5. Module

`src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository, UsersService],   // ✓ AuthModule cần UsersRepository
})
export class UsersModule {}
```

**`exports`** quan trọng: `AuthModule` import `UsersModule`, nhưng chỉ `inject` được những providers `UsersModule` `exports`. Không exports → DI lookup fail.

> Lưu ý: chỉ export những gì **thực sự** cần. Đừng export `UsersController` (controllers không thể export).

---

## B. ProductsModule (skeleton)

Pattern y hệt. Tạo các file:

```
src/products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── products.repository.ts
├── dto/
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
└── schemas/
    └── product.schema.ts
```

Stub controller:

```ts
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()                          // List sản phẩm public
  @Get()
  findAll() {
    return this.products.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.products.findById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser('id') userId: number) {
    return this.products.create({ ...dto, userId });
  }

  // ... patch, delete tương tự
}
```

Logic giống `prisma-practice/src/services/product.service.ts` cũ — port y nguyên vào `ProductsService`.

---

## C. Pagination helper

Express có `src/utils/pagination.ts`. NestJS giữ nguyên ý tưởng nhưng đặt ở `common/utils/`:

```ts
// src/common/utils/pagination.ts
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
```

Hoặc dùng `@nestjs/swagger` `PaginatedDto<T>` helper (search NestJS Swagger docs).

---

## D. Module dependency graph

Khi AuthModule cần inject `UsersRepository`:

```
AppModule
├── ConfigModule  (global)
├── LoggerModule
├── PrismaModule  (global)
├── RedisModule   (global)
├── AuthModule
│   ├── imports: [PassportModule, JwtModule.registerAsync(...), UsersModule]
│   ├── providers: [AuthService, JwtStrategy]
│   └── exports: [AuthService]   // nếu module khác cần inject AuthService
├── UsersModule
│   ├── providers: [UsersService, UsersRepository]
│   └── exports:   [UsersService, UsersRepository]   ← AuthService cần
└── ProductsModule
    ├── imports: [UsersModule]   // nếu cần check ownership
    ├── providers: [ProductsService, ProductsRepository]
    └── exports:   [...]
```

**Rule of thumb:**

- Provider muốn được module khác inject → phải nằm trong `exports` của module gốc
- Global module (`@Global()`) **không cần** import lại (Prisma, Redis, Config, Logger)
- Tránh **circular dependency** giữa modules — nếu A import B và B import A, refactor: tách logic chung ra module thứ 3

### Nếu vẫn bị circular

Nest cung cấp `forwardRef`:

```ts
@Module({
  imports: [forwardRef(() => OtherModule)],
})
```

Nhưng thường thì refactor tốt hơn — circular là dấu hiệu coupling sai chỗ.

---

## E. Constructor DI sâu hơn

NestJS Container resolve theo **type** (token mặc định là class). Có 4 loại provider:

```ts
// 1. Class (mặc định)
providers: [UsersService]
// inject:  constructor(private users: UsersService)

// 2. useClass
providers: [{ provide: UsersService, useClass: MockUsersService }]
// inject:  constructor(private users: UsersService) — vẫn type UsersService

// 3. useValue (cho config, mock)
providers: [{ provide: 'API_KEY', useValue: 'abc123' }]
// inject:  constructor(@Inject('API_KEY') private key: string)

// 4. useFactory (async, dynamic)
providers: [{
  provide: SomeService,
  inject: [ConfigService],
  useFactory: (config) => new SomeService(config.get('X')),
}]
```

`useClass` rất hữu ích cho testing — override implementation cụ thể.

---

## So sánh

| | Express cũ | NestJS |
|---|---|---|
| File organization | `controllers/`, `services/`, `repositories/` riêng | Folder theo feature: `users/` chứa tất cả |
| Wiring | Import singleton ở mỗi file | Constructor inject + `@Module({ providers })` |
| Route registration | `app.use('/users', userRouter)` | `@Controller('users')` + Nest tự scan |
| Param parsing | `req.params.id`, manual `Number()` | `@Param('id', ParseIntPipe) id: number` |
| Body validation | Middleware `validate(schema)` | DTO + `ZodValidationPipe` global |
| Auth check | Middleware `requireAuth` per route | `@UseGuards(JwtAuthGuard)` hoặc global guard + `@Public()` |
| Output shape | `sendSuccess(res, data)` | `return data` — interceptor wrap |
| Inject lib (Prisma, Redis) | Import singleton | `constructor(prisma: PrismaService, redis: RedisService)` |

## Bước tiếp theo

[08-health-swagger.md](./08-health-swagger.md) — Health check + OpenAPI Swagger từ Zod DTOs.
