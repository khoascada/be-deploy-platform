# NestJS Practice — Port từ `prisma-practice` (Express)

Folder này chứa **bộ tài liệu hướng dẫn** để bạn tự build lại BE Express bằng NestJS, giữ nguyên kiến trúc 4-tầng (controller → service → repository → prisma) nhưng tận dụng những thứ NestJS cung cấp sẵn (DI, decorators, guards, pipes, filters, interceptors, lifecycle hooks...).

## Đọc theo thứ tự

| # | File | Nội dung |
|---|---|---|
| 00 | [roadmap/00-overview.md](./roadmap/00-overview.md) | Triết lý NestJS + bảng mapping Express → NestJS + project structure tổng quan |
| 01 | [roadmap/01-bootstrap.md](./roadmap/01-bootstrap.md) | Tạo project, `package.json`, `tsconfig`, `nest-cli.json`, `.env`, install deps |
| 02 | [roadmap/02-config-module.md](./roadmap/02-config-module.md) | `@nestjs/config` + Zod validate env (thay `src/config/env.ts`) |
| 03 | [roadmap/03-prisma-module.md](./roadmap/03-prisma-module.md) | `PrismaService` extends `PrismaClient` + `@Global()` module + lifecycle |
| 04 | [roadmap/04-redis-logger.md](./roadmap/04-redis-logger.md) | `RedisModule` (ioredis wrapper) + `nestjs-pino` với correlation ID |
| 05 | [roadmap/05-common-layer.md](./roadmap/05-common-layer.md) | Exception filters, interceptors, middleware, guards, custom decorators |
| 06 | [roadmap/06-auth-module.md](./roadmap/06-auth-module.md) | `@nestjs/passport` + `passport-jwt` strategy + Auth controller/service + RBAC |
| 07 | [roadmap/07-feature-modules.md](./roadmap/07-feature-modules.md) | Users + Products module: controller/service/repository pattern với DI |
| 08 | [roadmap/08-health-swagger.md](./roadmap/08-health-swagger.md) | `@nestjs/terminus` health check + `nestjs-zod` Swagger gen |
| 09 | [roadmap/09-mapping-cheatsheet.md](./roadmap/09-mapping-cheatsheet.md) | Cheatsheet 1 trang: dòng nào Express → dòng nào NestJS |

## Tech stack mục tiêu

- **Framework**: NestJS 10 + Express adapter (`@nestjs/platform-express`)
- **DB**: Prisma 7 với `@prisma/adapter-pg` (giữ nguyên schema từ `prisma-practice`)
- **Validation**: `nestjs-zod` (tái sử dụng Zod schemas)
- **Auth**: `@nestjs/passport` + `passport-jwt` + JWT blacklist trên Redis
- **Cache**: `ioredis` (wrap trong service)
- **Logging**: `nestjs-pino` với redaction + request ID
- **Docs**: `@nestjs/swagger` + `nestjs-zod` patch (auto-gen từ Zod DTOs)
- **Health**: `@nestjs/terminus` (built-in indicators cho Prisma & Redis)

## Không có gì trong folder này ngoài markdown

Theo yêu cầu, repo này chỉ chứa tài liệu. Bạn sẽ tự `mkdir` source code và follow theo các bước trong [roadmap/01-bootstrap.md](./roadmap/01-bootstrap.md).
