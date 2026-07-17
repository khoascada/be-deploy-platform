import { AUTH } from '@/common/constants';
import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(AUTH.NAME_MIN_LENGTH).optional(),
  email: z.email().optional(),
  theme: z.enum(['LIGHT', 'DARK']).optional(),
  language: z.enum(['VI', 'EN']).optional(),
  avatarUrl: z.string().optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(6),
});
