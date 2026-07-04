import { z } from 'zod';

const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ENV_VALUE_MAX_LENGTH = 64 * 1024;

const envKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(ENV_KEY_REGEX, 'Invalid environment variable key');

const envValueSchema = z.string().max(ENV_VALUE_MAX_LENGTH);

export const createEnvVarSchema = z
  .object({
    key: envKeySchema,
    value: envValueSchema,
    scope: z.enum(['RUNTIME', 'BUILD', 'BOTH']),
    isEnabled: z.boolean().default(true),
  })
  .strict();

export const updateEnvVarSchema = z
  .object({
    key: envKeySchema.optional(),
    value: envValueSchema.optional(),
    scope: z.enum(['RUNTIME', 'BUILD', 'BOTH']).optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateEnvVarInput = z.infer<typeof createEnvVarSchema>;
export type UpdateEnvVarInput = z.infer<typeof updateEnvVarSchema>;
