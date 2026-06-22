import { createZodDto } from 'nestjs-zod';
import { githubBranchParamsSchema } from '../schemas/github.schema';

export class GithubBranchParamsDto extends createZodDto(
  githubBranchParamsSchema,
) {}
