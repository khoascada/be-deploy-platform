import { ApiProperty } from '@nestjs/swagger';

export class GithubBranchCommitDto {
  @ApiProperty({ example: 'c5b97d5ae6c19d5c5df71a34c7fbeeda2479ccbc' })
  sha!: string;

  @ApiProperty({
    example:
      'https://api.github.com/repos/octocat/Hello-World/commits/c5b97d5ae6c19d5c5df71a34c7fbeeda2479ccbc',
  })
  url!: string;
}

export class GithubBranchListItemDto {
  @ApiProperty({ example: 'main' })
  name!: string;

  @ApiProperty({ example: false })
  protected!: boolean;

  @ApiProperty({ type: GithubBranchCommitDto })
  commit!: GithubBranchCommitDto;
}

export class GithubBranchListMetaDto {
  @ApiProperty({ example: 8 })
  total!: number;
}

export class GithubBranchListResponseDto {
  @ApiProperty({ type: [GithubBranchListItemDto] })
  items!: GithubBranchListItemDto[];

  @ApiProperty({ type: GithubBranchListMetaDto })
  meta!: GithubBranchListMetaDto;
}

export function toGithubBranchListItemDto(branch: {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
    url: string;
  };
}): GithubBranchListItemDto {
  return {
    name: branch.name,
    protected: branch.protected,
    commit: {
      sha: branch.commit.sha,
      url: branch.commit.url,
    },
  };
}
