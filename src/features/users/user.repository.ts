import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(args: { skip: number; take: number }) {
    return this.prisma.user.findMany({
      skip: args.skip,
      take: args.take,
      orderBy: { id: 'desc' },
    });
  }

  count() {
    return this.prisma.user.count();
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: {
    email: string;
    password: string;
    name?: string;
    age?: number;
    address?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  update(
    id: number,
    data: { name?: string; email?: string; age?: number; address?: string },
  ) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }
}
