import { PAGINATION } from '@/common/constants';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

export class PaginationDto extends createZodDto(paginationSchema) {}
