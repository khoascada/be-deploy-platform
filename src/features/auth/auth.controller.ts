import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { ApiSuccess } from '@/common/swagger/api-success-response';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import AuthService from './auth.service';
import {
  LoginResponseDto,
  RegisterResponseDto,
  TokensDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @ApiOperation({ summary: 'Login' })
  @ApiSuccess(LoginResponseDto)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiOperation({ summary: 'Refresh access token' })
  @ApiSuccess(TokensDto)
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Logout' })
  @ApiBearerAuth('access-token')
  @ApiNoContentResponse({ description: 'Logged out successfully' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    const atTtlSec = Math.max(0, user.exp - Math.floor(Date.now() / 1000));
    return this.auth.logout(user.id, user.jti, atTtlSec, dto.refreshToken);
  }
}
