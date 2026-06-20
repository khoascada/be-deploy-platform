import { RATE_LIMIT } from '@/common/constants';
import { ConfigModule } from '@/config/config.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CsrfOriginGuard } from '@/common/guards/csrf-origin.guard';
import { AuthModule } from '@/features/auth/auth.module';
import { GithubModule } from '@/features/github/github.module';
import { UserModule } from '@/features/users/user.module';
import { LoggerModule } from '@/logger/logger.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisModule } from '@/redis/redis.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    GithubModule,
    UserModule,
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: RATE_LIMIT.GLOBAL.windowMs,
        limit: RATE_LIMIT.GLOBAL.max,
      },
      {
        name: 'auth',
        ttl: RATE_LIMIT.AUTH.windowMs,
        limit: RATE_LIMIT.AUTH.max,
      },
    ]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfOriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
