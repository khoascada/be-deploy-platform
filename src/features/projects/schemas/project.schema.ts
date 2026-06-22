import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

const optionalPortNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid port number',
      });
      return z.NEVER;
    }

    return parsed;
  });

const nullablePortNumber = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx) => {
    if (value === '' || value === undefined || value === null) {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid port number',
      });
      return z.NEVER;
    }

    return parsed;
  });

export const createProjectSchema = z
  .object({
    githubRepoId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    deployBranch: z.string().trim().min(1),
    repoFullName: z.string().trim().min(1),
    repoOwner: z.string().trim().min(1),
    repoName: z.string().trim().min(1),
    repoUrl: z.url(),
    githubDefaultBranch: z.string().trim().min(1),
    rootDirectory: optionalTrimmedString,
    dockerfilePath: optionalTrimmedString,
    buildContext: optionalTrimmedString,
    containerPort: optionalPortNumber,
    hostPort: nullablePortNumber,
    autoDeploy: z.boolean().default(false),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
