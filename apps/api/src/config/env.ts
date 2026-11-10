import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at boot. A missing or malformed
 * variable fails the process on startup naming the variable — not as `undefined` deep in a
 * connection string an hour into a deploy.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MONGO_URI: z.string().min(1),

  /** Comma-separated allowed browser origins, for the `cors` middleware. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001')
    .transform((value) => value.split(',').map((origin) => origin.trim())),

  /** Signs access tokens. Refresh tokens are opaque random values, so they need no secret. */
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** Customers open a link and stay signed in, so their sessions are longer. */
  CUSTOMER_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(90),
  CUSTOMER_INVITE_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  /** Refresh-cookie settings (web only). `none` is for a web app on a different site; needs HTTPS. */
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  COOKIE_DOMAIN: z.string().min(1).optional(),

  /** Where customer invite links point (the web app). */
  WEB_BASE_URL: z.string().url().default('http://localhost:3001'),

  /**
   * Time rules, in DAYS (decimals allowed: 0.001 is about a minute, handy for demos and tests).
   * A lead not Won/Lost and unchanged this long is "stuck" and gets stagnant reminders.
   */
  LEAD_STUCK_DAYS: z.coerce.number().positive().default(2),
  /** A sent proposal never opened after this long → "unseen" reminder (once). */
  REMINDER_UNSEEN_DAYS: z.coerce.number().positive().default(2),
  /** A proposal opened this long ago with no status change since → "no action" reminder (once). */
  REMINDER_NO_ACTION_DAYS: z.coerce.number().positive().default(2),
  /** Stagnant reminders repeat every LEAD_STUCK_DAYS, at most this many times per stuck period. */
  REMINDER_STAGNANT_MAX: z.coerce.number().int().min(1).default(3),
  /** How often the reminder job runs. It is idempotent, so a shorter interval only means quicker alerts. */
  REMINDER_INTERVAL_MINUTES: z.coerce.number().positive().default(60),

  /** Run scheduled jobs in this process. True on exactly one instance. */
  ENABLE_CRON: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
