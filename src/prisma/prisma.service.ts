import type { EnvVars } from '@/config/env.validation';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// @Injectable() → đánh dấu class này có thể được DI container inject vào nơi khác
// extends PrismaClient → PrismaService CHÍNH LÀ PrismaClient
//   → dùng được this.prisma.user.findMany() tự nhiên trong repository
// implements OnModuleInit, OnModuleDestroy → hook vào lifecycle của NestJS
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  // NestJS tự inject ConfigService vào đây (DI) — không cần tự new
  // ConfigService<EnvVars, true> → strict mode: get('KEY') trả đúng kiểu từ EnvVars
  constructor(config: ConfigService<EnvVars, true>) {
    // pg.Pool quản lý connection pool đến Postgres
    const pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
    });
    // super() gọi constructor PrismaClient với adapter pg
    // PrismaPg là adapter để Prisma 7 dùng pg thay vì driver mặc định
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  // Chạy 1 lần khi module được khởi tạo → connect DB sớm để fail-fast nếu DB down
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  // Chạy khi app shutdown (SIGTERM/SIGINT) — cần enableShutdownHooks() trong main.ts
  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end(); // đóng pg.Pool, giải phóng toàn bộ connections
    this.logger.log('Prisma disconnected');
  }
}
