import { COOKIE } from '@/common/constants';
import type { CookieOptions, Request, Response } from 'express';

function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || rawValue.length === 0) return acc;

    acc[rawName] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

export function getCookieValue(
  req: Pick<Request, 'headers'> | undefined,
  name: string,
): string | undefined {
  return parseCookieHeader(req?.headers.cookie)[name];
}

function createCookieOptions(
  path: string,
  maxAge: number,
  secure: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: COOKIE.SAME_SITE,
    path,
    maxAge,
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  secure: boolean,
) {
  res.cookie(
    COOKIE.ACCESS_TOKEN,
    tokens.accessToken,
    createCookieOptions(COOKIE.ACCESS_PATH, COOKIE.ACCESS_MAX_AGE, secure),
  );
  res.cookie(
    COOKIE.REFRESH_TOKEN,
    tokens.refreshToken,
    createCookieOptions(COOKIE.REFRESH_PATH, COOKIE.REFRESH_MAX_AGE, secure),
  );
}

export function clearAuthCookies(res: Response, secure: boolean) {
  res.clearCookie(
    COOKIE.ACCESS_TOKEN,
    createCookieOptions(COOKIE.ACCESS_PATH, COOKIE.ACCESS_MAX_AGE, secure),
  );
  res.clearCookie(
    COOKIE.REFRESH_TOKEN,
    createCookieOptions(COOKIE.REFRESH_PATH, COOKIE.REFRESH_MAX_AGE, secure),
  );
}
