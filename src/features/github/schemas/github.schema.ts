import { z } from 'zod';

const oauthStateParamSchema = z.string().trim().min(1).max(256);

export const githubCallbackQuerySchema = z
  .object({
    code: z.string().trim().min(1).max(512).optional(),
    error: z.string().trim().min(1).max(128).optional(),
    error_description: z.string().max(1024).optional(),
    error_uri: z.string().max(2048).optional(),
    state: oauthStateParamSchema,
  })
  .strict()
  // Callback phải có đúng một nhánh: thành công với code hoặc thất bại với error.
  .superRefine((value, ctx) => {
    const hasCode = value.code !== undefined;
    const hasError = value.error !== undefined;

    if (hasCode === hasError) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of code or error is required',
      });
    }

    if (hasCode && (value.error_description || value.error_uri)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Error metadata is only valid for an error callback',
      });
    }
  });

export const githubOAuthStateSchema = z.object({
  userId: z.string().min(1),
  codeVerifier: z.string().min(43).max(128),
  createdAt: z.number().int().positive(),
});

export const githubTokenSuccessResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
  scope: z.string().default(''),
});

export const githubTokenErrorResponseSchema = z.object({
  error: z.string().min(1),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});

export const githubUserProfileSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  name: z.string().nullable(),
  avatar_url: z.url().nullable(),
});

export type GithubCallbackQueryInput = z.infer<
  typeof githubCallbackQuerySchema
>;
export type GithubOAuthState = z.infer<typeof githubOAuthStateSchema>;
export type GithubTokenSuccessResponse = z.infer<
  typeof githubTokenSuccessResponseSchema
>;
