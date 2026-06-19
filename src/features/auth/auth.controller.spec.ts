import { AUTH_ERROR_CODE } from '@/common/constants';
import type { EnvVars } from '@/config/env.validation';
import { UnauthorizedError } from '@/common/exceptions/app.exceptions';
import { ConfigService } from '@nestjs/config';
import type AuthService from './auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('throws a stable business code when refresh token cookie is missing', async () => {
    const controller = new AuthController(
      {} as AuthService,
      {
        get: jest.fn().mockReturnValue('development'),
      } as unknown as ConfigService<EnvVars, true>,
    );

    await expect(
      controller.refresh({ headers: {} } as never, {} as never),
    ).rejects.toMatchObject(
      new UnauthorizedError(
        'Refresh token cookie is missing',
        AUTH_ERROR_CODE.REFRESH_TOKEN_MISSING,
      ),
    );
  });
});
