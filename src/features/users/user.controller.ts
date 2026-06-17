import {
  AuthUser,
  CurrentUser,
} from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { RolesGuard } from '@/common/guards/roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }

  @ApiBearerAuth() // đính kèm AT vào request có decorator này
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.users.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findById(id);
  }

  @Patch('me')
  update(@Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.update(user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.users.remove(id);
  }
}
