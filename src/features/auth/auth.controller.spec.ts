import { AUTH_ERROR_CODE } from '@/common/constants';
import { UnauthorizedError } from '@/common/exceptions/app.exceptions';
import type { EnvVars } from '@/config/env.validation';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
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

    const response = {
      clearCookie: jest.fn(),
      cookie: jest.fn(),
    } as unknown as Response;

    await expect(
      controller.refresh({ headers: {} } as never, response),
    ).rejects.toMatchObject(
      new UnauthorizedError(
        'Refresh token cookie is missing',
        AUTH_ERROR_CODE.REFRESH_TOKEN_MISSING,
      ),
    );
  });
});
