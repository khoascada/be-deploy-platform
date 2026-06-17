# 08 — Health Check + Swagger / OpenAPI

## Mục tiêu

- Replace `src/routes/health.router.ts` Express bằng `@nestjs/terminus`
- Replace toàn bộ `src/openapi/` Express (zod-to-openapi + swagger-ui-express) bằng `@nestjs/swagger` + `nestjs-zod` (auto-gen từ Zod DTOs)

---

## A. Health check với `@nestjs/terminus`

### Express cũ

```ts
// health.router.ts (đơn giản hóa)
router.get('/health', (_, res) => res.json({ status: 'ok' }));

router.get('/ready', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(503).json({ status: 'fail', error: e.message });
  }
});
```

### NestJS — Terminus indicators

`src/health/prisma.health.ts` (custom indicator vì Terminus không có sẵn cho Prisma):

```ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('Prisma check failed', this.getStatus(key, false, {
        message: (e as Error).message,
      }));
    }
  }
}
```

`src/health/redis.health.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') throw new Error('Unexpected response');
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, {
        message: (e as Error).message,
      }));
    }
  }
}
```

`src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Public()
  @Get('health')
  @HealthCheck()
  liveness() {
    // Liveness chỉ check process còn chạy — không cần dep nào
    return this.health.check([]);
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.prismaHealth.isHealthy('database'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
```

`src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
```

### Response format

`@nestjs/terminus` trả format chuẩn:

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" }, "redis": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" }, "redis": { "status": "up" } }
}
```

Khi 1 indicator fail → HTTP 503 + `status: "error"`. Hơi khác format `{ success, data, error }` chung — nhưng kubernetes/load balancer hiểu format này tốt.

> Nếu muốn ép cùng format `{success, data}`, viết interceptor riêng cho `HealthController`, **không** dùng global `ResponseInterceptor` (skip qua decorator + reflector).

---

## B. Swagger / OpenAPI với `@nestjs/swagger` + `nestjs-zod`

### Tại sao bỏ `@asteasolutions/zod-to-openapi`?

Express cũ phải tự register từng schema vào `OpenAPIRegistry`, tự map từng route trong `src/openapi/routes/*.openapi.ts`. **NestJS có plugin tự scan decorators + controllers** → spec sinh tự động. Kết hợp `nestjs-zod` patch để Zod DTOs cũng được nhận diện.

### Setup

```bash
npm i @nestjs/swagger nestjs-zod
```

`src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module';

// Patch Swagger để nhận Zod DTOs (createZodDto)
patchNestJsSwagger();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NestJS Practice API')
      .setDescription('Port của prisma-practice Express → NestJS')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('products', 'Product CRUD')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(3000);
}
bootstrap();
```

→ Truy cập `http://localhost:3000/docs` thấy Swagger UI.

### Decorators trên controllers

`@nestjs/swagger` có plugin trong `nest-cli.json` (xem [01-bootstrap.md](./01-bootstrap.md)) tự thêm `@ApiProperty` cho DTOs. Nhưng cần tự thêm vài decorator cho rõ ràng:

```ts
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('users')                         // Group trong Swagger UI
@ApiBearerAuth('access-token')            // Tất cả route trong controller này cần Bearer
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Get current user profile' })
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) { ... }

  @ApiOperation({ summary: 'List users (admin only)' })
  @Roles('ADMIN')
  @Get()
  findAll(@Query() pagination: PaginationDto) { ... }
}
```

### Đánh dấu route public không cần Bearer trong Swagger

```ts
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // KHÔNG có @ApiBearerAuth ở class level

  @ApiOperation({ summary: 'Register new user' })
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) { ... }
}
```

### Response shape

Plugin tự scan return type, nhưng vì `ResponseInterceptor` wrap `{ success, data }`, Swagger không biết. Tạo wrapper:

```ts
// src/common/swagger/api-success-response.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export const ApiSuccess = <T extends Type>(model: T) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
```

Sử dụng:

```ts
@ApiSuccess(UserDto)
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) { ... }
```

### Zod DTO + Swagger

`createZodDto` của `nestjs-zod` + `patchNestJsSwagger()` đảm bảo Swagger reflect đúng shape của Zod schema:

```ts
// auth.schema.ts
export const registerSchema = z
  .object({
    email: z.email().describe('User email'),                  // ← .describe() → description trong OpenAPI
    password: z.string().min(6).describe('Min 6 characters'),
    name: z.string().min(2).optional(),
  })
  .describe('Register payload');

// dto/register.dto.ts
export class RegisterDto extends createZodDto(registerSchema) {}

// controller
@Post('register')
register(@Body() dto: RegisterDto) { ... }
```

→ Swagger UI hiển thị schema đầy đủ field + description + required/optional.

### Output DTOs

Cho response, hoặc dùng class với `@ApiProperty`:

```ts
// users/dto/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER' }) role!: string;
}
```

Hoặc tiếp tục dùng Zod cho cả output (nhất quán):

```ts
const userResponseSchema = z.object({
  id: z.number(),
  email: z.email(),
  name: z.string().nullable(),
  role: z.string(),
});
export class UserDto extends createZodDto(userResponseSchema) {}
```

---

## C. Helmet, CORS, body parser, rate limit trong `main.ts`

Cuối cùng, `main.ts` đầy đủ wire-up các middleware tương đương `src/index.ts` Express cũ:

```ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { ZodValidationPipe } from 'nestjs-zod';
import type { EnvVars } from '@/config/env.validation';

patchNestJsSwagger();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<EnvVars, true>>(ConfigService);

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(',').map((s) => s.trim()),
    credentials: true,
  });

  // Global pipe / interceptor / filter
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());

  // Swagger (dev only)
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS Practice API')
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Graceful shutdown → triggers OnModuleDestroy hooks
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
  Logger.log(`API listening on http://localhost:${config.get('PORT', { infer: true })}`, 'Bootstrap');
}
bootstrap();
```

> Thứ tự `app.use(helmet())` → `enableCors` → middleware (nếu có) → pipes/interceptors/filters (đăng ký global ảnh hưởng toàn bộ).

### Body parser

NestJS với platform-express dùng sẵn `express.json()` ngầm. Không cần `app.use(express.json())` thủ công. Nếu muốn custom limit:

```ts
const app = await NestFactory.create(AppModule, { bodyParser: false });
app.use(express.json({ limit: '1mb' }));
```

---

## So sánh tổng thể

| | Express cũ | NestJS |
|---|---|---|
| Health check | Manual `/health`, `/ready` | `@nestjs/terminus` + indicators |
| OpenAPI registry | `zod-to-openapi` + manual route specs | `@nestjs/swagger` + plugin auto-scan |
| Zod DTOs trong Swagger | Phải `extendZodWithOpenApi(z)` + register thủ công | `nestjs-zod` + `patchNestJsSwagger()` |
| Helmet/CORS | `app.use(helmet())`, `app.use(cors({...}))` | `app.use(helmet())`, `app.enableCors({...})` |
| Body parser | `app.use(express.json())` | Built-in |
| Swagger UI mount | `swagger-ui-express` | `SwaggerModule.setup('docs', app, document)` |

## Bước tiếp theo

[09-mapping-cheatsheet.md](./09-mapping-cheatsheet.md) — Tra cứu nhanh 1 trang.
