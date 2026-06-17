import { SetMetadata } from '@nestjs/common';
import type { Role } from '@/common/constants';

export const ROLES_KEY = 'roles';

// Gắn metadata roles lên route — RolesGuard đọc key này để kiểm tra quyền
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
