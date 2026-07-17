import { createZodDto } from 'nestjs-zod';
import { changePasswordSchema } from '@/features/users/schemas/user.schema';

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
