import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DEFAULT_DEPLOYMENTS_LIMIT = 20;

export const getProjectDeploymentsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(DEFAULT_DEPLOYMENTS_LIMIT).default(DEFAULT_DEPLOYMENTS_LIMIT),
});

export class GetProjectDeploymentsQueryDto extends createZodDto(
  getProjectDeploymentsQuerySchema,
) {}
