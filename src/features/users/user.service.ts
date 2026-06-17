import type { PaginationDto } from '@/common/dto/pagination.dto';
import { NotFoundError } from '@/common/exceptions/app.exceptions';
import { Injectable } from '@nestjs/common';
import type { UpdateUserDto } from './dto/update-user.dto';
import { toUserDetailDto, toUserDto } from './dto/user-response.dto';
import { UsersRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly users: UsersRepository) {}

  async findAll(pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;
    const [items, total] = await Promise.all([
      this.users.findAll({ skip, take: pagination.limit }),
      this.users.count(),
    ]);
    return {
      items: items.map(toUserDto),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async findById(id: number) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(`User not found`);
    return toUserDetailDto(user);
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findById(id);
    const updated = await this.users.update(id, dto);
    return toUserDetailDto(updated);
  }

  async remove(id: number) {
    await this.findById(id);
    await this.users.delete(id);
  }
}
