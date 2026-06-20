import { createZodDto } from 'nestjs-zod';
import { githubCallbackQuerySchema } from '../schemas/github.schema';

export class GithubCallbackQueryDto extends createZodDto(
  githubCallbackQuerySchema,
) {}
