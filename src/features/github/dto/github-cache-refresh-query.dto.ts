import { createZodDto } from 'nestjs-zod';
import { githubCacheRefreshQuerySchema } from '../schemas/github.schema';

export class GithubCacheRefreshQueryDto extends createZodDto(
  githubCacheRefreshQuerySchema,
) {}
