import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Parses body/query/params with the given zod schemas (from `@vastu/contracts`) and reassigns the
 * PARSED value — `.default()`/`.transform()` only take effect on what `.parse()` returns. A thrown
 * ZodError is turned into a 400 by `error-handler.ts`.
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}): RequestHandler {
  return (req, _res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  };
}
