import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
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

// --- Mappers ---

export function toAuthUserDto(user: User): AuthUserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function toRegisterResponseDto(user: User): RegisterResponseDto {
  return { user: toAuthUserDto(user) };
}
