import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class UserDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: null, nullable: true }) avatarUrl!: string | null;
}

export class UserDetailDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: null, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ example: true }) isGithubConnected!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

export function toUserDetailDto(
  user: User & { isGithubConnected?: boolean },
): UserDetailDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isGithubConnected: user.isGithubConnected ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
