import { createZodDto } from 'nestjs-zod';
import { logoutSchema } from '../schemas/auth.schema';

export class LogoutDto extends createZodDto(logoutSchema) {}
