import { createZodDto } from 'nestjs-zod';
import { updateUserSchema } from '@/features/users/schemas/user.schema';

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
