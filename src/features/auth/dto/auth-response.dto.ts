import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
}

export class LoginResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}

export class TokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
}

// --- Mappers ---

export function toAuthUserDto(user: User): AuthUserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function toRegisterResponseDto(user: User): RegisterResponseDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
