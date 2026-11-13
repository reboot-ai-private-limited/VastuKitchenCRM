import pino from 'pino';
import { env, isProduction } from '@/config/env.js';
import { getRequestId } from '@/shared/http/request-context.js';

/**
 * Structured logs to stdout. NOTE THE ARGUMENT ORDER: `logger.info({ data }, 'message')`.
 * Messages must be static strings (enforced by ESLint) so `redact` below can do its job.
 */
const REDACTED_PATHS = [
  'phone',
  '*.phone',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'otp',
  '*.otp',
  'req.headers.authorization',
  'headers.authorization',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  // Stamps every line with the current request ID from async context.
  mixin() {
    const requestId = getRequestId();
    return requestId === undefined ? {} : { requestId };
  },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{if requestId}[{requestId}] {end}{msg}',
          },
        },
      }),
});
