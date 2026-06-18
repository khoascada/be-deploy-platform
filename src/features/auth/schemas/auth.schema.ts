import { AUTH } from '@/common/constants';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
  name: z.string().min(AUTH.NAME_MIN_LENGTH),
  theme: z.enum(['LIGHT', 'DARK']),
  language: z.enum(['VI', 'EN']),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
});

export const refreshTokenSchema = z.object({
});

export const logoutSchema = z.object({
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
