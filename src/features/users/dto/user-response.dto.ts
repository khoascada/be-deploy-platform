import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

export class UserDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: null, nullable: true }) avatarUrl!: string | null;
}

export class GithubConnectionDto {
  @ApiProperty({ example: true }) isConnected!: boolean;
  @ApiProperty({ example: 'octocat', nullable: true }) username!: string | null;
  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/1?v=4',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class UserDetailDto {
  @ApiProperty({ example: 'clx123abc456def789ghi012' }) id!: string;
  @ApiProperty({ example: 'user@example.com' }) email!: string;
  @ApiProperty({ example: 'John', nullable: true }) name!: string | null;
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] }) role!: string;
  @ApiProperty({ example: null, nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ type: GithubConnectionDto }) githubConnection!: GithubConnectionDto;
  @ApiProperty({ example: 'LIGHT', enum: ['LIGHT', 'DARK'] }) theme!: string;
  @ApiProperty({ example: 'EN', enum: ['VI', 'EN'] }) language!: string;
  @ApiProperty({ example: false }) isVerifiedEmail!: boolean;
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
  user: User & {
    githubConnection?: {
      isConnected?: boolean;
      username?: string | null;
      avatarUrl?: string | null;
    };
  },
): UserDetailDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    githubConnection: {
      isConnected: user.githubConnection?.isConnected ?? false,
      username: user.githubConnection?.username ?? null,
      avatarUrl: user.githubConnection?.avatarUrl ?? null,
    },
    theme: user.theme,
    language: user.language,
    isVerifiedEmail: user.isVerifiedEmail,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
