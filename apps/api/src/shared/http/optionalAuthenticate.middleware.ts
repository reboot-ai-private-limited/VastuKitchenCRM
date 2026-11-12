import type { RequestHandler } from 'express';
import { verifyAccessToken } from './jwt.util.js';

/**
 * Like `authenticate`, but never refuses: a valid bearer token sets `req.user`, anything else
 * leaves it unset. For public endpoints that behave differently when a signed-in person calls.
 */
export const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  const payload = token ? verifyAccessToken(token) : null;
  if (payload) req.user = { sub: payload.sub, role: payload.role };
  next();
};
