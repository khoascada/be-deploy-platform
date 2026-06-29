import { z } from 'zod';

// Dam bao key cau hinh decode duoc thanh dung 32 byte truoc khi dung cho AES-256.
const githubEncryptionKeySchema = z
  .string()
  .refine(
    (value) => Buffer.from(value, 'base64').length === 32,
    'GITHUB_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
  );

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:2805'),
  FRONTEND_URL: z.url().default('http://localhost:2805'),
  BACKEND_URL: z.url().default('http://localhost:3000'),
  NGROK_URL: z.url().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REPOSITORIES_ROOT: z.string().default('/var/lib/deploy-platform/repositories'),
  DEPLOYMENT_QUEUE_PREFIX: z.string().min(1).default('deploy-platform'),
  DEPLOYMENT_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_REDIRECT_URI: z.url().optional(),
  GITHUB_OAUTH_SCOPE: z.string().min(1).optional(),
  GITHUB_TOKEN_ENCRYPTION_KEY: githubEncryptionKeySchema.optional(),
});

export type EnvVars = z.infer<typeof envSchema>;

export const validateEnv = (config: Record<string, unknown>): EnvVars => {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    throw new Error(
      'Invalid environment variables:\n' +
        JSON.stringify(errors, null, 2),
    );
  }
  return parsed.data;
};
