import { AUTH_ERROR_CODE } from '@/common/constants';
import type { EnvVars } from '@/config/env.validation';
import type { RedisService } from '@/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('throws a stable code when the access token has been revoked', async () => {
    const strategy = new JwtStrategy(
      {
        get: jest.fn().mockReturnValue('secret'),
      } as unknown as ConfigService<EnvVars, true>,
      {
        exists: jest.fn().mockResolvedValue(1),
      } as unknown as RedisService,
    );

    await expect(
      strategy.validate({
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        jti: 'access-jti',
      } satisfies JwtPayload),
    ).rejects.toMatchObject({
      response: {
        code: AUTH_ERROR_CODE.TOKEN_REVOKED,
      },
      status: 401,
    });
  });
});
