import type { Request, Response } from 'express';
import type { AuthTokensDto, ClientKind } from '@vastu/contracts';
import { env, isProduction } from '@/config/env.js';
import type { IssuedSession } from '../application/services/sessionIssuer.js';

/**
 * How the refresh token reaches each kind of client (chosen by the `X-Client` header):
 *  - web    → httpOnly cookie. JavaScript on the page can never read it (XSS-safe); never in the body.
 *  - mobile → JSON body; the app keeps it in secure storage.
 */
export const REFRESH_COOKIE = 'vk_refresh';
/** Scoped to the auth routes, so the cookie is not sent with every API call. */
const COOKIE_PATH = '/api/identity/auth';

/** Attributes that must match exactly for a cookie to be overwritten or cleared. */
function baseCookieOptions() {
  return {
    httpOnly: true,
    // SameSite=None is only accepted by browsers together with Secure.
    secure: isProduction || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: COOKIE_PATH,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  } as const;
}

/** Builds the token part of the response body and, for web, sets the cookie. */
export function deliverTokens(
  res: Response,
  client: ClientKind,
  session: IssuedSession,
): AuthTokensDto {
  const base = { accessToken: session.accessToken, expiresIn: session.expiresIn };
  if (client === 'mobile') return { ...base, refreshToken: session.refreshToken };

  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...baseCookieOptions(),
    maxAge: session.refreshExpiresAt.getTime() - Date.now(),
  });
  return base;
}

/** Cookie for web, `refreshToken` in the body for mobile. */
export function readRefreshToken(req: Request, client: ClientKind): string | undefined {
  if (client === 'web') {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
  const body: unknown = req.body;
  const token = (body as { refreshToken?: unknown } | undefined)?.refreshToken;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
}
