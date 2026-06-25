import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: '/avatar', nullable: true }) avatarUrl!:
    | string
    | null;
  @ApiProperty({ example: 'LIGHT', enum: ['LIGHT', 'DARK'] }) theme!: string;
  @ApiProperty({ example: 'EN', enum: ['VI', 'EN'] }) language!: string;
  @ApiProperty({ example: false }) isVerifiedEmail!: boolean;
}

export class RegisterResponseDto {
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}

export class LoginResponseDto {
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}

export class RefreshResponseDto {
  @ApiProperty({ example: 'Token refreshed successfully' }) message!: string;
}

export function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    theme: user.theme,
    language: user.language,
    isVerifiedEmail: user.isVerifiedEmail,
  };
}

export function toRegisterResponseDto(user: User): RegisterResponseDto {
  return { user: toAuthUserDto(user) };
}
