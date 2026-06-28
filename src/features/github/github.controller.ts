import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GithubBranchListResponseDto } from './dto/github-branch-list-response.dto';
import { GithubBranchParamsDto } from './dto/github-branch-params.dto';
import { GithubCacheRefreshQueryDto } from './dto/github-cache-refresh-query.dto';
import { GithubCallbackQueryDto } from './dto/github-callback-query.dto';
import { GithubRepoListResponseDto } from './dto/github-repo-list-response.dto';
import { GithubService } from './github.service';

@ApiTags('github')
@Controller('github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @ApiOperation({ summary: 'Redirect user to GitHub OAuth login' })
  @Get('oauth/login')
  async oauthLogin(@Res() res: Response, @CurrentUser('id') userId: string) {
    const redirect = await this.github.getOAuthLoginRedirect(userId);
    return res.redirect(redirect.statusCode, redirect.url);
  }

  @ApiOperation({ summary: 'Callback for GitHub OAuth' })
  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query() query: GithubCallbackQueryDto,
    @Res() res: Response,
  ) {
    const redirect = await this.github.oAuthCallback(query);
    return res.redirect(redirect.statusCode, redirect.url);
  }

  @ApiOperation({ summary: 'Call for get list repo from github' })
  @ApiOkResponse({ type: GithubRepoListResponseDto })
  @Get('repos')
  async getListRepos(
    @CurrentUser('id') userId: string,
    @Query() query: GithubCacheRefreshQueryDto,
  ) {
    return this.github.getListRepos(userId, query.isRefresh);
  }

  @ApiOperation({ summary: 'Call for get list branch in repo from github' })
  @ApiOkResponse({ type: GithubBranchListResponseDto })
  @Get('repos/:owner/:repo/branches')
  async getListBranches(
    @CurrentUser('id') userId: string,
    @Param() params: GithubBranchParamsDto,
    @Query() query: GithubCacheRefreshQueryDto,
  ) {
    return this.github.getListBranches(
      userId,
      params.owner,
      params.repo,
      query.isRefresh,
    );
  }

  @ApiOperation({ summary: 'GitHub repository webhook receiver' })
  @Public()
  @Post('webhooks/repository')
  @HttpCode(HttpStatus.NO_CONTENT)
  handleRepositoryWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-github-hook-id') hookId: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: unknown,
  ) {
    void signature;
    void payload;
    console.log('GitHub webhook received:', {
      event,
      deliveryId,
      hookId,
    });

    return;
  }
}
