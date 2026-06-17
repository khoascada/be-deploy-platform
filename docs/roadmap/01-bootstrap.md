# 01 — Bootstrap project

## Mục tiêu

- Khởi tạo NestJS project rỗng tương đương `prisma-practice/` ban đầu
- Cài đặt toàn bộ dependencies cần thiết
- Setup `tsconfig`, `nest-cli.json`, scripts npm, `.env`
- Copy `prisma/schema.prisma` từ project Express cũ

## 1. Tạo project bằng Nest CLI

Cách nhanh nhất:

```bash
npm i -g @nestjs/cli
nest new nestjs-practice --package-manager npm --strict
cd nestjs-practice
```

`nest new` sẽ tạo sẵn `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, kèm `tsconfig.json`, `nest-cli.json`, `eslint.config`, `package.json` đầy đủ scripts.

**Xóa** `app.controller.ts` + `app.service.ts` mặc định — ta sẽ tạo feature modules riêng.

> Nếu không muốn dùng CLI, có thể tạo tay theo template ở cuối file này.

## 2. Cài dependencies

```bash
# Core NestJS
npm i @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs

# Config + Validation
npm i @nestjs/config zod nestjs-zod

# Database
npm i @prisma/client @prisma/adapter-pg pg
npm i -D prisma

# Auth
npm i @nestjs/passport @nestjs/jwt passport passport-jwt bcryptjs jsonwebtoken
npm i -D @types/passport-jwt @types/bcryptjs @types/jsonwebtoken

# Cache
npm i ioredis

# Logging
npm i nestjs-pino pino pino-http
npm i -D pino-pretty

# Security
npm i helmet

# Rate limit
npm i @nestjs/throttler

# Health check
npm i @nestjs/terminus

# API docs
npm i @nestjs/swagger

# Testing
npm i -D @nestjs/testing supertest @types/supertest jest @types/jest ts-jest
```

> **Lưu ý**: `@nestjs/swagger` v8+ tương thích NestJS 10. `nestjs-zod` v4+ tương thích Zod 4.

## 3. Cấu trúc thư mục

Tạo skeleton folders:

```bash
mkdir -p src/{common/{filters,interceptors,middleware,pipes,decorators,guards,exceptions,context},config,prisma,redis,logger,health,auth/{strategies,guards,dto,schemas},users/{dto,schemas},products/{dto,schemas}}
mkdir prisma
mkdir test
```

## 4. `package.json` scripts

Đảm bảo scripts gồm:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```

So với `prisma-practice` cũ: bỏ `dev` (nodemon), `nest start --watch` đã có watch built-in. Không cần `tsc-alias` vì `nest build` handle path alias.

## 5. `tsconfig.json`

NestJS 10 cần `experimentalDecorators` + `emitDecoratorMetadata` để `@Injectable()` hoạt động. Path alias `@/*` giữ giống `prisma-practice`.

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

`tsconfig.build.json` exclude test + spec files:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

## 6. `nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.build.json",
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "introspectComments": true
        }
      }
    ]
  }
}
```

**Plugin `@nestjs/swagger`**: tự đọc JSDoc + decorator để generate OpenAPI spec, đỡ phải viết `@ApiProperty()` cho từng field.

## 7. Copy Prisma schema

```bash
cp ../prisma-practice/prisma/schema.prisma prisma/schema.prisma
```

Không cần thay đổi gì — NestJS dùng cùng `@prisma/client` + `@prisma/adapter-pg`.

Sau đó:

```bash
npm run prisma:generate
```

## 8. `.env.example`

Giống `prisma-practice` cũ, các biến giữ nguyên tên:

```dotenv
NODE_ENV=development
PORT=3000

# Postgres
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public"

# JWT
JWT_SECRET="thay-bang-chuoi-toi-thieu-16-ky-tu"
JWT_EXPIRES_IN=7d

# CORS — comma-separated
CORS_ORIGIN=http://localhost:5173

# Redis
REDIS_URL=redis://localhost:6379
```

`.env` (gitignored) — copy `.env.example` rồi điền giá trị thật.

## 9. `.gitignore`

```
node_modules
dist
.env
*.log
coverage
.idea
.vscode
```

## 10. Verify

Sau khi setup xong:

```bash
npm run prisma:generate
npm run build         # nest build phải pass
npm run start:dev     # server chạy ở port 3000
```

Lúc này chưa có route nào nên `GET /` trả 404 — bình thường. Bước tiếp theo là setup `ConfigModule`.

---

## Phụ lục — `package.json` mẫu (nếu không dùng nest CLI)

```json
{
  "name": "nestjs-practice",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/swagger": "^8.0.0",
    "@nestjs/terminus": "^10.2.3",
    "@nestjs/throttler": "^6.2.0",
    "@prisma/adapter-pg": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "bcryptjs": "^3.0.3",
    "helmet": "^8.1.0",
    "ioredis": "^5.10.1",
    "jsonwebtoken": "^9.0.3",
    "nestjs-pino": "^4.1.0",
    "nestjs-zod": "^4.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pg": "^8.20.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.2.0",
    "@nestjs/testing": "^10.4.0",
    "@types/jest": "^29.5.13",
    "@types/node": "^22.7.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "pino-pretty": "^13.1.3",
    "prisma": "^7.8.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.0"
  }
}
```

## Bước tiếp theo

[02-config-module.md](./02-config-module.md) — Thay `src/config/env.ts` cũ bằng `ConfigModule` của NestJS, giữ Zod validation.
