import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

export interface CreateGithubConnectionData {
  userId: string;
  githubUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accessTokenEncrypted: string;
  scopes: string | null;
}

@Injectable()
export class GithubRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy user cùng trạng thái connection để chặn user không tồn tại hoặc đã connect.
  findUserWithConnection(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        githubConnection: { select: { id: true } },
      },
    });
  }

  // Kiểm tra GitHub account này đã được liên kết với user nội bộ nào khác chưa.
  findByGithubUserId(githubUserId: string) {
    return this.prisma.githubConnection.findUnique({
      where: { githubUserId },
      select: { id: true, userId: true },
    });
  }

  findByUserId(userId: string) {
    return this.prisma.githubConnection.findUnique({
      where: {userId}
    })
  }

  // Tạo connection mới sau khi service đã hoàn tất toàn bộ bước xác thực OAuth.
  create(data: CreateGithubConnectionData) {
    return this.prisma.githubConnection.create({ data });
  }
}
