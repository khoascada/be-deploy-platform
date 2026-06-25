import { AUTH } from '@/common/constants';
import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(AUTH.NAME_MIN_LENGTH).optional(),
  email: z.email().optional(),
});
