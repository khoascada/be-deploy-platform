import type { EnvVars } from '@/config/env.validation';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Không extends như PrismaService vì ioredis không cần override gì —
// chỉ cần wrap lại những method hay dùng để tiện inject
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // public readonly để service khác có thể gọi raw ioredis API nếu cần (pipeline, pubsub...)
  readonly client: Redis;

  // ConfigService<EnvVars, true> inject qua DI — không tự new
  constructor(config: ConfigService<EnvVars, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true, // chưa connect ngay — đợi gọi tường minh ở onModuleInit
      maxRetriesPerRequest: 3, // retry 3 lần trước khi throw lỗi
    });
    // lắng nghe event ioredis — log khi có lỗi hoặc connect thành công
    this.client.on('error', (e) => this.logger.error(e, 'Redis error'));
    this.client.on('connect', () => this.logger.log('Redis connected'));
  }

  // Chạy khi module khởi tạo → connect Redis (vì có implements OnModuleInit)
  async onModuleInit() {
    await this.client.connect();
  }

  // Chạy khi app shutdown → đóng connection sạch (cần enableShutdownHooks trong main.ts)
  async onModuleDestroy() {
    await this.client.quit();
  }

  // --- Wrapper methods ---
  // Lý do wrap: service khác inject RedisService, gọi thẳng method này
  // thay vì this.redis.client.setex(...) — gọn hơn, dễ mock trong test hơn

  // Lưu key với TTL (giây) — dùng cho refresh token, blacklist JWT
  setex(key: string, ttlSec: number, value: string) {
    return this.client.setex(key, ttlSec, value);
  }

  // Lấy value theo key — trả null nếu không tồn tại hoặc đã hết TTL
  get(key: string) {
    return this.client.get(key);
  }

  // Xóa key — dùng khi logout (xóa refresh token)
  del(key: string) {
    return this.client.del(key);
  }

  // Kiểm tra key có tồn tại không — trả số lượng key tìm thấy (0 hoặc 1)
  exists(key: string) {
    return this.client.exists(key);
  }

  // Gửi PING đến Redis — dùng cho health check endpoint ở Phase 08
  ping() {
    return this.client.ping();
  }
}
