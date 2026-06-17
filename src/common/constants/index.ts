export const TOKEN_TTL = {
  ACCESS: 15 * 60,
  REFRESH: 7 * 24 * 3600,
} as const;

export const REDIS_KEY = {
  refreshToken: (userId: number, jti: string) => `refresh:${userId}:${jti}`,
  blacklist: (jti: string) => `blacklist:${jti}`,
} as const;

export const ROLES = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const AUTH = {
  BEARER_PREFIX: 'Bearer ',
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
} as const;

export const BCRYPT = { SALT_ROUNDS: 10 } as const;

export const RATE_LIMIT = {
  GLOBAL: { windowMs: 15 * 60 * 1000, max: 100 },
  AUTH: { windowMs: 15 * 60 * 1000, max: 10 },
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const COOKIE = {
  TOKEN: 'token',
  MAX_AGE: 7 * 24 * 60 * 60 * 1000,
} as const;
