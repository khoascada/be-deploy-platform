import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLogs(deploymentId: string) {
    return this.prisma.deploymentLog.findMany({
      where: { deploymentId },
      orderBy: { seq: 'asc' },
    });
  }
}
