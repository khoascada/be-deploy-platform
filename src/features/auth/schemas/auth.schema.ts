import { AUTH } from '@/common/constants';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
  name: z.string().min(AUTH.NAME_MIN_LENGTH).optional(),
  age: z.number().min(10).optional(),
  address: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(AUTH.PASSWORD_MIN_LENGTH),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const logoutSchema = z.object({
  refreshToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
