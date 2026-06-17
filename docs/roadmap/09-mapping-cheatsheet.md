# 09 — Mapping Cheatsheet

Tra cứu nhanh: dòng nào trong Express → dòng nào trong NestJS.

## File-level mapping

| Express (`prisma-practice/src/`) | NestJS (`nestjs-practice/src/`) |
|---|---|
| `index.ts` | `main.ts` + `app.module.ts` |
| `config/env.ts` | `config/env.validation.ts` + `config/config.module.ts` |
| `config/logger.ts` | `logger/logger.module.ts` |
| `config/redis.ts` | `redis/redis.module.ts` + `redis/redis.service.ts` |
| `prisma.ts` | `prisma/prisma.module.ts` + `prisma/prisma.service.ts` |
| `middlewares/auth.middleware.ts` | `auth/strategies/jwt.strategy.ts` + `auth/guards/jwt-auth.guard.ts` |
| `middlewares/error.middleware.ts` | `common/filters/all-exceptions.filter.ts` |
| `middlewares/not-found.middleware.ts` | (Nest tự xử lý 404) |
| `middlewares/request-id.middleware.ts` | `common/middleware/request-id.middleware.ts` (hoặc bỏ — `nestjs-pino` lo) |
| `middlewares/validate.middleware.ts` | `nestjs-zod` `ZodValidationPipe` (global) |
| `errors/index.ts` (AppError + subclasses) | `common/exceptions/app.exceptions.ts` (extend `HttpException`) |
| `errors/handle-prisma-error.ts` | `common/filters/prisma-exception.filter.ts` |
| `utils/response.ts` (`sendSuccess`) | `common/interceptors/response.interceptor.ts` |
| `utils/context.ts` (AsyncLocalStorage) | Bỏ — `nestjs-pino` auto context |
| `utils/pagination.ts` | `common/utils/pagination.ts` |
| `routes/auth.router.ts` | `auth/auth.controller.ts` |
| `routes/user.router.ts` | `users/users.controller.ts` |
| `routes/product.router.ts` | `products/products.controller.ts` |
| `routes/health.router.ts` | `health/health.controller.ts` (+ Terminus) |
| `controllers/*.controller.ts` | Gộp vào `<feature>/<feature>.controller.ts` |
| `services/*.service.ts` | Gộp vào `<feature>/<feature>.service.ts` (class `@Injectable()`) |
| `repositories/*.repository.ts` | Gộp vào `<feature>/<feature>.repository.ts` (class `@Injectable()`) |
| `schemas/*.schema.ts` | `<feature>/schemas/<feature>.schema.ts` (giữ Zod) |
| `dtos/*.dto.ts` | `<feature>/dto/*.dto.ts` (`createZodDto(...)`) |
| `openapi/*` | Bỏ — `@nestjs/swagger` + `nestjs-zod` thay |
| `constants/*` | `common/constants/*` |

## Code snippet mapping

### Init app

```ts
// EXPRESS
const app = express();
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN.split(',') }));
app.use(express.json());
app.listen(env.PORT);
```

```ts
// NESTJS — main.ts
const app = await NestFactory.create(AppModule);
app.use(helmet());
app.enableCors({ origin: config.get('CORS_ORIGIN').split(',') });
// express.json đã built-in
await app.listen(config.get('PORT'));
```

### Route

```ts
// EXPRESS
router.post('/login', authLimiter, validate(loginSchema), authController.login);
```

```ts
// NESTJS
@Throttle({ auth: { ttl: 900_000, limit: 10 } })
@Public()
@Post('login')
login(@Body() dto: LoginDto) {
  return this.auth.login(dto);
}
```

### Auth middleware → Guard

```ts
// EXPRESS
export const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.slice(7);
  const decoded = jwt.verify(token, env.JWT_SECRET);
  req.user = decoded;
  next();
};
app.use('/users', requireAuth, userRouter);
```

```ts
// NESTJS — strategy + guard + global registration
// strategy
@Injectable()
class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }
  validate(payload) { return payload; }
}

// guard
@Injectable()
class JwtAuthGuard extends AuthGuard('jwt') {}

// global
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]

// controller — đánh dấu public nếu cần
@Public() @Post('login') login() { ... }
```

### Error middleware → Exception filter

```ts
// EXPRESS
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: { code: err.code, ... } });
  }
  res.status(500).json({...});
});
```

```ts
// NESTJS — main.ts
app.useGlobalFilters(new AllExceptionsFilter());
// + filter class catches HttpException, formats response
```

### Validation middleware → Pipe

```ts
// EXPRESS
const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('...', parsed.error.flatten());
  req.body = parsed.data;
  next();
};
router.post('/register', validate(registerSchema), ctrl);
```

```ts
// NESTJS — global, no per-route wiring
// main.ts
app.useGlobalPipes(new ZodValidationPipe());

// controller
@Post('register') register(@Body() dto: RegisterDto) { ... }
// RegisterDto = createZodDto(registerSchema)
```

### Response wrapper

```ts
// EXPRESS
res.status(200).json({ success: true, data: user });
```

```ts
// NESTJS — controller chỉ return data
@Get(':id')
findOne(@Param('id') id: string) { return this.users.findById(+id); }
// Interceptor global wrap → { success: true, data: ... }
```

### Inject Prisma

```ts
// EXPRESS
import prisma from '@/prisma';
prisma.user.findUnique({...});
```

```ts
// NESTJS
constructor(private readonly prisma: PrismaService) {}
this.prisma.user.findUnique({...});
```

### Inject Redis

```ts
// EXPRESS
import redis from '@/config/redis';
await redis.setex(key, ttl, '1');
```

```ts
// NESTJS
constructor(private readonly redis: RedisService) {}
await this.redis.setex(key, ttl, '1');
```

### Sign JWT

```ts
// EXPRESS
jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL.ACCESS });
```

```ts
// NESTJS
constructor(private readonly jwt: JwtService) {}
this.jwt.sign(payload, { expiresIn: TOKEN_TTL.ACCESS });
// JwtModule.registerAsync đã set secret từ ConfigService
```

### Logger

```ts
// EXPRESS
import logger from '@/config/logger';
logger.info({ userId }, 'fetched user');
```

```ts
// NESTJS
private readonly logger = new Logger(MyService.name);
this.logger.log({ userId }, 'fetched user');
// hoặc inject PinoLogger nếu cần API rộng hơn
```

### Health check

```ts
// EXPRESS
router.get('/ready', async (_, res) => {
  await prisma.$queryRaw`SELECT 1`;
  await redis.ping();
  res.json({ status: 'ok' });
});
```

```ts
// NESTJS — health.controller.ts
@Public()
@Get('ready')
@HealthCheck()
readiness() {
  return this.health.check([
    () => this.prismaHealth.isHealthy('database'),
    () => this.redisHealth.isHealthy('redis'),
  ]);
}
```

### Shutdown

```ts
// EXPRESS
process.on('SIGTERM', async () => {
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});
```

```ts
// NESTJS — main.ts
app.enableShutdownHooks();
// PrismaService + RedisService có onModuleDestroy() tự được gọi
```

### Rate limit

```ts
// EXPRESS
import rateLimit from 'express-rate-limit';
app.use(rateLimit({ windowMs: 900_000, max: 100 }));
```

```ts
// NESTJS
ThrottlerModule.forRoot([{ name: 'global', ttl: 900_000, limit: 100 }]);
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }];
// per-route
@Throttle({ auth: { ttl: 900_000, limit: 10 } })
@Post('login') login() { ... }
```

### OpenAPI

```ts
// EXPRESS — manual registration
registry.registerPath({ method: 'post', path: '/auth/register', ... });
app.use('/docs', swaggerUi.serve, swaggerUi.setup(getOpenApiSpec()));
```

```ts
// NESTJS — auto from decorators + Zod DTOs
patchNestJsSwagger();
const document = SwaggerModule.createDocument(app, builder.build());
SwaggerModule.setup('docs', app, document);
// Controllers + DTOs đã đủ — không cần register thủ công
```

## Quick decision table

| Câu hỏi | Trả lời |
|---|---|
| Có nên giữ tên file `*.controller.ts`, `*.service.ts`? | Có — convention NestJS |
| Có cần đổi từ Zod sang class-validator? | Không — `nestjs-zod` cho phép giữ Zod |
| Có cần Passport hay tự verify JWT? | Dùng Passport — convention rõ ràng |
| Có cần `tsconfig-paths` runtime? | Không — `nest build` xử lý alias |
| Có cần `nodemon`? | Không — `nest start --watch` |
| Có cần `tsc-alias`? | Không — `nest build` đã handle |
| Repository nên là class hay object literal? | Class `@Injectable()` — để DI |
| Provider có cần `@Injectable()`? | Có — để metadata cho container |
| Lifecycle hook nào cho disconnect? | `onModuleDestroy()` + `app.enableShutdownHooks()` |
| Default guard cho tất cả route? | `APP_GUARD` provider + `@Public()` opt-out |
| Wrapping response `{ success, data }`? | `ResponseInterceptor` global |
| Validate global hay per-route? | Global `ZodValidationPipe` |

## Anti-patterns (đừng làm)

1. **Inject `PrismaService` vào controller** — bypass tầng repository/service. Luôn `Controller → Service → Repository → Prisma`.
2. **Dùng `@Res()` thay vì return** — mất ResponseInterceptor (vẫn được nhưng phải tự `res.json`).
3. **Tự `try-catch` ở controller** — để filter handle. Trừ khi cần transform exception (ví dụ map domain error sang HTTP).
4. **Tạo singleton import** (`export const someService = new SomeService()`) — phá DI, khó test.
5. **Đặt `@Global()` cho feature module** — chỉ infrastructure (Prisma, Redis, Config, Logger) nên global.
6. **Circular import giữa 2 module** — refactor hoặc dùng `forwardRef` (dấu hiệu thiết kế chưa ổn).
7. **Quên `app.enableShutdownHooks()`** — `onModuleDestroy` không chạy, connection leak.
8. **Quên `useLogger(app.get(Logger))`** trong main.ts — Nest dùng ConsoleLogger thay vì pino.

## Hết roadmap

- Đọc lại [00-overview.md](./00-overview.md) để có hình dung lớn
- Khi viết feature mới, follow pattern ở [07-feature-modules.md](./07-feature-modules.md)
- Khi cần thêm thứ chéo (rate limit theo user, audit log, soft delete), tham khảo Nest docs hoặc `nestjs-pattern`/`@nestjs/cls` packages
