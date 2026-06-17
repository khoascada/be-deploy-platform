import { createZodDto } from 'nestjs-zod';
import { registerSchema } from '../schemas/auth.schema';

export class RegisterDto extends createZodDto(registerSchema) {}
