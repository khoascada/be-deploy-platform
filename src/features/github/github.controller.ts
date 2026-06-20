import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GithubCallbackQueryDto } from './dto/github-callback-query.dto';
import { GithubService } from './github.service';

@ApiTags('github')
@Controller('github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @ApiOperation({ summary: 'Redirect user to GitHub OAuth login' })
  @Get('oauth/login')
  // Chuyển browser của user sang trang authorize GitHub bằng HTTP 302.
  async oauthLogin(@Res() res: Response, @CurrentUser('id') userId: string) {
    const redirect = await this.github.getOAuthLoginRedirect(userId);
    return res.redirect(redirect.statusCode, redirect.url);
  }

  @ApiOperation({ summary: 'Callback for GitHub OAuth' })
  @Public()
  @Get('oauth/callback')
  // Nhận kết quả GitHub trả về và tiếp tục redirect browser theo kết quả xử lý của service.
  async oauthCallback(
    @Query() query: GithubCallbackQueryDto,
    @Res() res: Response,
  ) {
    const redirect = await this.github.oAuthCallback(query);
    return res.redirect(redirect.statusCode, redirect.url);
  }
}
