import { createZodDto } from 'nestjs-zod';
import { loginSchema } from '../schemas/auth.schema';

export class LoginDto extends createZodDto(loginSchema) {}
