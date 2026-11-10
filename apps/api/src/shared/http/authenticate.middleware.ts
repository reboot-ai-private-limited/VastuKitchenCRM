import type { RequestHandler } from 'express';
import { AppError } from '@/shared/errors/AppError.js';
import { verifyAccessToken } from './jwt.util.js';

/** Requires `Authorization: Bearer <access token>` and sets `req.user`. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) return next(AppError.unauthenticated());
  req.user = { sub: payload.sub, role: payload.role };
  next();
};
