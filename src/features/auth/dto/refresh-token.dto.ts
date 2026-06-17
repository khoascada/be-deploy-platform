import { createZodDto } from 'nestjs-zod';
import { refreshTokenSchema } from '../schemas/auth.schema';

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
