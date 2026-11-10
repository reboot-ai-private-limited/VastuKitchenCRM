import type { RequestHandler } from 'express';
import type { RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';

/**
 * Role gate, used in ROUTE files only — use cases never look at role names (ADR-0009). Put it
 * after `authenticate`. Moving to permissions later means changing these calls, nothing deeper.
 */
export function requireRole(...roles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthenticated());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}
