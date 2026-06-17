import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

export type EnvVars = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): EnvVars => {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(errors, null, 2)}`,
    );
  }
  return parsed.data;
};
