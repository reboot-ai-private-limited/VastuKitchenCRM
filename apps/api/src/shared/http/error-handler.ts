import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/shared/errors/AppError.js';
import { logger } from '@/shared/logging/logger.js';
import { buildErrorBody } from './response.util.js';

/** The single place an error becomes a response. Register LAST in `app.ts`. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    // Expected errors are traffic, not incidents — logging them at `error` hides real faults.
    logger[err.isExpected ? 'info' : 'error'](
      { code: err.code, status: err.statusCode, url: req.originalUrl, details: err.details },
      'request failed',
    );
    res.status(err.statusCode).json(
      buildErrorBody(req, {
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        publicDetails: err.publicDetails,
        details: err.details,
        stack: err.stack,
      }),
    );
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      buildErrorBody(req, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Some of the details provided are not valid.',
        publicDetails: err.issues,
      }),
    );
    return;
  }

  const bodyError = (err as { type?: string } | null)?.type;
  if (bodyError === 'entity.too.large') {
    res.status(413).json(
      buildErrorBody(req, {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'This request is too large. Send it in smaller parts.',
      }),
    );
    return;
  }
  if (bodyError === 'entity.parse.failed') {
    res.status(400).json(
      buildErrorBody(req, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'The request body is not valid JSON.',
      }),
    );
    return;
  }

  const stack = err instanceof Error ? err.stack : undefined;
  logger.error({ url: req.originalUrl, err: String(err), stack }, 'unhandled error');
  res.status(500).json(
    buildErrorBody(req, {
      statusCode: 500,
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again shortly.',
      stack,
    }),
  );
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    buildErrorBody(req, {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
    }),
  );
}
