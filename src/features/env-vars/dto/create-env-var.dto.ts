import { createZodDto } from 'nestjs-zod';
import { createEnvVarSchema } from '../schemas/env-var.schema';

export class CreateEnvVarDto extends createZodDto(createEnvVarSchema) {}
