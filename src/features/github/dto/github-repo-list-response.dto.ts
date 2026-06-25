import { ApiProperty } from '@nestjs/swagger';

export class GithubRepoOwnerDto {
  @ApiProperty({ example: 'octocat' })
  login!: string;

  @ApiProperty({
    example: 'https://avatars.githubusercontent.com/u/1?v=4',
    nullable: true,
  })
  avatarUrl!: string | null;
}

export class GithubRepoListItemDto {
  @ApiProperty({ example: '123456789' })
  id!: string;

  @ApiProperty({ example: 'deploy-platform' })
  name!: string;

  @ApiProperty({ example: 'octocat/deploy-platform' })
  fullName!: string;

  @ApiProperty({ type: GithubRepoOwnerDto })
  owner!: GithubRepoOwnerDto;

  @ApiProperty({ example: 'https://github.com/octocat/deploy-platform' })
  url!: string;

  @ApiProperty({ example: 'main' })
  defaultBranch!: string;

  @ApiProperty({ example: false })
  private!: boolean;
}

export class GithubRepoListMetaDto {
  @ApiProperty({ example: 42 })
  total!: number;
}

export class GithubRepoListResponseDto {
  @ApiProperty({ type: [GithubRepoListItemDto] })
  items!: GithubRepoListItemDto[];

  @ApiProperty({ type: GithubRepoListMetaDto })
  meta!: GithubRepoListMetaDto;
}

export function toGithubRepoListItemDto(repo: {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: {
    login: string;
    avatar_url: string | null;
  };
}): GithubRepoListItemDto {
  return {
    id: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    defaultBranch: repo.default_branch,
    private: repo.private,
    owner: {
      login: repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
    },
  };
}
