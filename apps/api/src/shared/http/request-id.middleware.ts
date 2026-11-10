import type { RequestHandler } from 'express';
import { newRequestId } from '@/shared/ids.js';
import { runWithContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Assigns every request an ID (an inbound header wins) and exposes it to the whole call tree. */
export function requestIdMiddleware(): RequestHandler {
  return (req, res, next) => {
    const inbound = req.headers[REQUEST_ID_HEADER];
    const requestId = (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || newRequestId();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    runWithContext({ requestId }, next);
  };
}
