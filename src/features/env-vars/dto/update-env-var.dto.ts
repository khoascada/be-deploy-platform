import { createZodDto } from 'nestjs-zod';
import { updateEnvVarSchema } from '../schemas/env-var.schema';

export class UpdateEnvVarDto extends createZodDto(updateEnvVarSchema) {}
