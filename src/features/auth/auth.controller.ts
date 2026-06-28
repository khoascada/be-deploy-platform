import { AUTH_ERROR_CODE, COOKIE } from '@/common/constants';
import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { UnauthorizedError } from '@/common/exceptions/app.exceptions';
import { ApiSuccess } from '@/common/swagger/api-success-response';
import {
  clearAuthCookies,
  getCookieValue,
  setAuthCookies,
} from '@/common/utils/cookie.util';
import type { EnvVars } from '@/config/env.validation';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import AuthService from './auth.service';
import {
  LoginResponseDto,
  RefreshResponseDto,
  RegisterResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvVars, true>,
  ) {}

  private isSecureCookie() {
    // return this.config.get('NODE_ENV', { infer: true }) === 'production';
    return false;
  }

  @ApiOperation({ summary: 'Register new user' })
  @ApiCreatedResponse({
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        data: { $ref: getSchemaPath(RegisterResponseDto) },
      },
    },
  })
  @ApiExtraModels(RegisterResponseDto)
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    setAuthCookies(res, result, this.isSecureCookie());
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Login' })
  @ApiSuccess(LoginResponseDto)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    setAuthCookies(res, result, this.isSecureCookie());
    return { user: result.user };
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiSuccess(RefreshResponseDto)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const refreshToken = getCookieValue(req, COOKIE.REFRESH_TOKEN);
      if (!refreshToken) {
        throw new UnauthorizedError(
          'Refresh token cookie is missing',
          AUTH_ERROR_CODE.REFRESH_TOKEN_MISSING,
        );
      }

      const tokens = await this.auth.refresh(refreshToken);
      setAuthCookies(res, tokens, this.isSecureCookie());
      return { message: 'Token refreshed successfully' };
    } catch (error) {
      // bị 401 thì clear cookie
      if (error instanceof UnauthorizedError) {
        clearAuthCookies(res, this.isSecureCookie());
      }
      throw error;
    }
  }

  @ApiOperation({ summary: 'Logout' })
  @ApiNoContentResponse({ description: 'Logged out successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const atTtlSec = Math.max(0, user.exp - Math.floor(Date.now() / 1000));
    const refreshToken = getCookieValue(req, COOKIE.REFRESH_TOKEN) ?? '';

    await this.auth.logout(user.id, user.jti, atTtlSec, refreshToken);
    clearAuthCookies(res, this.isSecureCookie());
  }
}
