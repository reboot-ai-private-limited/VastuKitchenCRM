import type { Request } from 'express';
import { CLIENT_HEADER, clientKindSchema, type ClientKind } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';

/**
 * Which client is calling, from the required `X-Client` header. Decides how the refresh token
 * travels: cookie for `web`, JSON body for `mobile`. Requiring an explicit custom header also
 * protects the cookie flow from CSRF — a cross-site form cannot set it, and CORS preflight
 * blocks a cross-site script from doing so.
 */
export function requireClientKind(req: Request): ClientKind {
  const parsed = clientKindSchema.safeParse(req.headers[CLIENT_HEADER]);
  if (!parsed.success) {
    throw AppError.badRequest('Send an X-Client header of "web" or "mobile".');
  }
  return parsed.data;
}
