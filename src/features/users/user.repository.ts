import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { UserRole, type Language, type Theme } from '@prisma/client';

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

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { githubConnection: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    language: Language;
    theme: Theme;
  }) {
    return this.prisma.user.create({ data });
  }

  update(
    id: string,
    data: { name?: string; email?: string; avatarUrl?: string },
  ) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
