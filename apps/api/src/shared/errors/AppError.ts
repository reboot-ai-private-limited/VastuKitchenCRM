import type { FaultCode } from '@vastu/contracts';

/**
 * An error with an HTTP status and a caller-safe message.
 *
 * Two detail channels, not interchangeable:
 *  - `publicDetails` — what the CALLER needs to act (which field was wrong). Sent in every env.
 *  - `details`       — diagnostics for US. Logged always, stripped from production responses.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: FaultCode;
  readonly details?: unknown;
  readonly publicDetails?: unknown;
  /** False for genuine faults — what should page someone. */
  readonly isExpected: boolean;

  constructor(opts: {
    statusCode: number;
    code: FaultCode;
    message: string;
    details?: unknown;
    publicDetails?: unknown;
    isExpected?: boolean;
    cause?: unknown;
  }) {
    super(opts.message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = 'AppError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
    this.publicDetails = opts.publicDetails;
    this.isExpected = opts.isExpected ?? true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, publicDetails?: unknown): AppError {
    return new AppError({ statusCode: 400, code: 'VALIDATION_FAILED', message, publicDetails });
  }
  static unauthenticated(message = 'Please sign in to continue.'): AppError {
    return new AppError({ statusCode: 401, code: 'UNAUTHENTICATED', message });
  }
  static forbidden(message = 'You do not have access to this.'): AppError {
    return new AppError({ statusCode: 403, code: 'FORBIDDEN', message });
  }
  static notFound(message = 'Not found.'): AppError {
    return new AppError({ statusCode: 404, code: 'NOT_FOUND', message });
  }
  static conflict(message: string, publicDetails?: unknown): AppError {
    return new AppError({ statusCode: 409, code: 'CONFLICT', message, publicDetails });
  }
  /** An external dependency is unconfigured or down. Expected: the caller can retry. */
  static unavailable(message: string, details?: unknown, cause?: unknown): AppError {
    return new AppError({ statusCode: 503, code: 'SERVICE_UNAVAILABLE', message, details, cause });
  }
  /** A violated invariant, not bad input. `isExpected: false` routes it to an alert. */
  static internal(code: FaultCode, details?: unknown, cause?: unknown): AppError {
    return new AppError({
      statusCode: 500,
      code,
      message: 'Something went wrong. Please try again shortly.',
      details,
      isExpected: false,
      cause,
    });
  }
}
