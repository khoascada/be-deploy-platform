// cái này config log pino đc xử lý như thế nào
import type { EnvVars } from '@/config/env.validation';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        pinoHttp: {
          // Dev: pretty-print màu sắc, dễ đọc. Prod: JSON thuần để đẩy vào log aggregator
          transport:
            config.get('NODE_ENV', { infer: true }) !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                }
              : undefined,

          // Ẩn thông tin nhạy cảm trong log — không bao giờ log token/password
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

          // Tạo request ID: reuse X-Request-Id từ client hoặc tự generate UUID
          // Set vào response header để client có thể trace request
          genReqId: (req, res) => {
            const existing =
              (req.headers['x-request-id'] as string) || randomUUID();
            res.setHeader('X-Request-Id', existing);
            return existing;
          },

          // Chỉ log những field cần thiết, bỏ bớt noise
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({
              statusCode: res.statusCode,
            }),
          },

          // Log level tùy theo status code
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
