import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class UserDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: '32 Dinh Tien Hoang', nullable: true }) address!:
    | string
    | null;
}

export class UserDetailDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: '32 Dinh Tien Hoang', nullable: true }) address!:
    | string
    | null;
  @ApiProperty({ example: true }) emailVerified!: boolean;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    address: user.address,
  };
}

export function toUserDetailDto(user: User): UserDetailDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    address: user.address,
    emailVerified: user.emailVerified,
  };
}
