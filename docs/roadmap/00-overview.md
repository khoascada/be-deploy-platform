# 00 — Overview: NestJS vs Express

## Triết lý khác biệt

Express là **một thư viện HTTP** — bạn tự wire-up tất cả: app, middleware, router, error handler, DI (nếu cần). Lợi: linh hoạt. Hại: project lớn thì khó duy trì convention, mỗi team viết một kiểu.

NestJS là **một framework opinion-ated** trên Express (hoặc Fastify), lấy cảm hứng từ Angular: code chia theo **module**, classes được decorate (`@Controller`, `@Injectable`, `@Module`...), framework chạy một **IoC container** để inject dependencies tự động. Lợi: convention rõ ràng, testable, scalable. Hại: phải học decorator + lifecycle + module graph.

## NestJS tự cung cấp những gì

Khi viết Express bạn phải **tự code** những thứ sau — NestJS đã làm sẵn:

| Concern | Express (tự viết) | NestJS (built-in) |
|---|---|---|
| Dependency Injection | Tự import singleton, hoặc dùng `tsyringe`/`awilix` | IoC container, constructor injection (`@Injectable()` + `@Module({ providers })`) |
| Route binding | `router.get('/x', handler)` | `@Controller('x') class { @Get() method() }` |
| Validation | Middleware custom đọc Zod, throw lỗi | **Pipe**: `@UsePipes(new ZodValidationPipe(schema))` |
| Auth | Middleware `requireAuth(req,res,next)` | **Guard**: `@UseGuards(JwtAuthGuard)` |
| Authorization (RBAC) | Tự viết `requireRole('ADMIN')` middleware | **Guard + Reflector**: `@Roles('ADMIN')` decorator |
| Error handling | 4-arg middleware `(err,req,res,next)` cuối cùng | **Exception Filter**: `@Catch(HttpException) class implements ExceptionFilter` |
| Response wrapping | Helper `sendSuccess(res, data)` | **Interceptor**: `intercept(ctx, next) { return next.handle().pipe(map(...)) }` |
| Lifecycle (init/shutdown) | `process.on('SIGTERM', ...)` thủ công | `OnModuleInit`, `OnApplicationShutdown` hooks + `app.enableShutdownHooks()` |
| Config | Tự `import 'dotenv/config'` + validate | `ConfigModule.forRoot({ validate, isGlobal })` |
| Logging | Tự setup pino + pino-http | `nestjs-pino` (`LoggerModule.forRoot({...})`) — auto bind request scope |
| Health check | Tự viết route `/health`, `/ready` | `@nestjs/terminus`: `HealthCheckService` + indicators |
| Rate limit | Tự `express-rate-limit` | `@nestjs/throttler`: `ThrottlerGuard` + `@Throttle()` |
| OpenAPI/Swagger | Tự `zod-to-openapi` + `swagger-ui-express` | `@nestjs/swagger`: auto-gen từ decorators + DTOs |
| Testing utils | Tự setup supertest | `@nestjs/testing`: `Test.createTestingModule()` + override providers |

## Project structure khuyến nghị

NestJS không bắt buộc, nhưng convention là **chia theo feature module** (không phải theo layer như Express cũ):

```
nestjs-practice/
├── prisma/
│   └── schema.prisma                  # Copy nguyên từ prisma-practice
│
├── src/
│   ├── main.ts                        # Bootstrap — tương đương src/index.ts cũ
│   ├── app.module.ts                  # Root module — gom tất cả feature modules
│   │
│   ├── common/                        # Cross-cutting (= middlewares/, errors/, utils/ cũ)
│   │   ├── filters/                   # Exception filters
│   │   ├── interceptors/              # Response wrappers, logging
│   │   ├── middleware/                # Request ID, etc.
│   │   ├── pipes/                     # ZodValidationPipe
│   │   ├── decorators/                # @CurrentUser, @Roles, @Public
│   │   ├── guards/                    # RolesGuard
│   │   ├── exceptions/                # HttpException subclasses
│   │   └── context/                   # AsyncLocalStorage
│   │
│   ├── config/                        # @nestjs/config + Zod env
│   │
│   ├── prisma/                        # PrismaModule (global)
│   ├── redis/                         # RedisModule (global)
│   ├── logger/                        # nestjs-pino setup
│   ├── health/                        # @nestjs/terminus
│   │
│   ├── auth/                          # Feature module: register/login/refresh/logout
│   ├── users/                         # Feature module: user CRUD
│   └── products/                      # Feature module: product CRUD
│
├── test/                              # E2E tests
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env
```

### Tại sao chia theo feature module (không theo layer)?

- **Express cũ**: `controllers/user.controller.ts`, `services/user.service.ts`, `repositories/user.repository.ts` — file `User` rải 3 chỗ.
- **NestJS**: `users/` chứa cả controller + service + repository + dto + schema. Khi xóa feature, xóa 1 folder. Khi đọc feature, mở 1 folder.

Cách này còn cho phép **lazy load module** (rare nhưng có) và làm rõ **module boundary** — một module muốn dùng provider của module khác thì module kia phải `exports`.

## Khái niệm cốt lõi cần thuộc lòng

1. **Module** — đơn vị tổ chức code. Mỗi module decorate `@Module({ imports, controllers, providers, exports })`.
   - `providers`: classes mà container sẽ inject (services, repositories, guards...)
   - `controllers`: classes bắt route HTTP
   - `imports`: module khác cần dùng provider của họ
   - `exports`: provider của module này cho phép module khác dùng

2. **Provider** — bất cứ thứ gì có thể inject. Mặc định là class decorate `@Injectable()`. Có thể là factory, value, async factory.

3. **Controller** — class decorate `@Controller('path')`. Mỗi method bắt 1 route qua `@Get`/`@Post`/`@Put`/`@Delete`/`@Patch`. Param decorators: `@Param()`, `@Query()`, `@Body()`, `@Headers()`, `@Req()`, `@Res()`.

4. **Guard** — chạy **trước** handler, trả `boolean` (true = pass, false = 403/401). Dùng cho auth, RBAC, feature flag.

5. **Pipe** — chạy **trước** handler, **transform + validate** input. Trả về giá trị mới hoặc throw exception.

6. **Interceptor** — wrap quanh handler (như middleware Koa). Có thể modify request **trước** + response **sau**. Dùng cho logging, response transform, cache, timeout.

7. **Exception Filter** — catch exception, trả response. Tương đương 4-arg middleware Express.

8. **Middleware** — vẫn có (NestJS gọi là "middleware"), chạy **trước** guards/pipes/interceptors. Express-style: `(req, res, next)`. Dùng cho việc thuần HTTP (request ID, body parser custom).

### Thứ tự chạy của một request (rất quan trọng)

```
Request
  ↓
[Middleware]               ← request-id, helmet, cors (Express-level)
  ↓
[Guard]                    ← JwtAuthGuard, RolesGuard
  ↓
[Interceptor (before)]     ← logging interceptor
  ↓
[Pipe]                     ← ZodValidationPipe
  ↓
[Controller method]        ← @Post() register(@Body() dto)
  ↓
[Interceptor (after)]      ← ResponseInterceptor wrap {success, data}
  ↓
Response
```

Nếu có exception ở **bất kỳ tầng nào** → nhảy thẳng vào `[Exception Filter]` rồi trả response.

## Đối chiếu kiến trúc 4 tầng

Tầng (Express cũ → NestJS) không thay đổi:

```
Route handler (Controller)
    ↓
Business logic (Service)         ← Injectable
    ↓
Data access (Repository)         ← Injectable
    ↓
ORM (PrismaService)              ← Injectable, extends PrismaClient
```

Khác biệt **duy nhất**: thay vì `import { userRepository } from '@/repositories/user.repository'`, bạn khai báo trong constructor:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}
}
```

NestJS sẽ **tự inject** `UsersRepository` instance (singleton trong module scope) qua container.

## Bước tiếp theo

Đọc [01-bootstrap.md](./01-bootstrap.md) để setup project.
