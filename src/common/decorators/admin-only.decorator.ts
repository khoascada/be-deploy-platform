import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { applyDecorators, UseGuards } from '@nestjs/common';

export function AdminOnly() {
  return applyDecorators(UseGuards(RolesGuard), Roles('ADMIN'));
}
