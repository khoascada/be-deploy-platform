import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(args: { skip: number; take: number }) {
    return this.prisma.project.findMany({
      skip: args.skip,
      take: args.take,
      orderBy: { id: 'desc' },
    });
  }

  count() {
    return this.prisma.project.count();
  }
}
