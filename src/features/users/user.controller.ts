import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { AdminOnly } from '@/common/decorators/admin-only.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.findMe(user.id);
  }

  @AdminOnly()
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.users.findAll(pagination);
  }

  @Patch('me')
  update(@Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.update(user.id, dto);
  }

  @AdminOnly()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.users.remove(id);
  }
}
