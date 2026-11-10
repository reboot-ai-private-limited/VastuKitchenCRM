import type { HttpErrorBody, HttpSuccessBody, RequestMeta } from '@vastu/contracts';
import type { Request, Response } from 'express';
import { isProduction } from '@/config/env.js';
import { getRequestId } from './request-context.js';

/** The two functions that build every response body. The envelope shape lives in contracts. */

function meta(req: Request): RequestMeta {
  return {
    method: req.method,
    url: req.originalUrl,
    requestId: getRequestId() ?? '',
    ...(isProduction || req.ip === undefined ? {} : { ip: req.ip }),
  };
}

export function sendSuccess<T>(
  req: Request,
  res: Response,
  data: T,
  message = 'OK',
  statusCode = 200,
): void {
  const body: HttpSuccessBody<T> = { success: true, statusCode, request: meta(req), message, data };
  res.status(statusCode).json(body);
}

export function buildErrorBody(
  req: Request,
  opts: {
    statusCode: number;
    code: string;
    message: string;
    publicDetails?: unknown;
    details?: unknown;
    stack?: string | undefined;
  },
): HttpErrorBody {
  const data = isProduction ? opts.publicDetails : (opts.details ?? opts.publicDetails);
  return {
    success: false,
    statusCode: opts.statusCode,
    code: opts.code,
    request: meta(req),
    message: opts.message,
    ...(data === undefined ? {} : { data }),
    ...(isProduction || opts.stack === undefined ? {} : { trace: opts.stack }),
  };
}
