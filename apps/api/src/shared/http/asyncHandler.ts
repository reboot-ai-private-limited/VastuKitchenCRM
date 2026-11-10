import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Forwards a rejected promise to Express's error handler (Express 4 doesn't await handlers, so an
 * async throw would otherwise hang the request). Every async route goes through this.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
