import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at boot. A missing or malformed
 * variable fails the process on startup naming the variable — not as `undefined` deep in a
 * connection string an hour into a deploy.
 */
/** `KEY=` in a `.env` file means "not set" (the example file ships that way), not an empty value. */
const blankAsUnset = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), inner);

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
  /** A just-rotated refresh token may be replayed once within this many seconds. 0 disables it. */
  REFRESH_GRACE_SECONDS: z.coerce.number().int().min(0).max(60).default(10),
  /** Customers open a link and stay signed in, so their sessions are longer. */
  CUSTOMER_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(90),
  CUSTOMER_INVITE_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  /** Refresh-cookie settings (web only). `none` is for a web app on a different site; needs HTTPS. */
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  COOKIE_DOMAIN: z.string().min(1).optional(),

  /**
   * Photo/file storage (Cloudinary). Optional at boot: every other route works without it, and
   * only signing an upload fails (with a clear 503). Put the real values in `.env`, never in git.
   */
  CLOUDINARY_CLOUD_NAME: blankAsUnset(z.string().min(1).optional()),
  CLOUDINARY_API_KEY: blankAsUnset(z.string().min(1).optional()),
  CLOUDINARY_API_SECRET: blankAsUnset(z.string().min(1).optional()),
  /** Every asset lives under this folder; use a different one per environment (e.g. vastu-dev). */
  CLOUDINARY_FOLDER: z.string().min(1).default('vastu'),

  /**
   * One-time codes for login, sent as a WhatsApp authentication template through WA AGENT. Optional
   * at boot: without them codes are printed to the API console instead (development only).
   */
  WA_AGENT_API_KEY: blankAsUnset(z.string().min(1).optional()),
  WA_AGENT_PHONE_NUMBER_ID: blankAsUnset(z.string().min(1).optional()),
  /** The login-code (AUTHENTICATION) template: its id from the portal, or its name (+ language). */
  WA_AGENT_OTP_TEMPLATE_ID: blankAsUnset(z.string().min(1).optional()),
  WA_AGENT_OTP_TEMPLATE: blankAsUnset(z.string().min(1).optional()),
  WA_AGENT_OTP_LANGUAGE: z.string().min(1).default('en'),
  /** The proposal-link template (`proposal_share`): body.1 name, body.2 number, body.3 company, button.0.1 token. */
  WA_AGENT_PROPOSAL_TEMPLATE_ID: blankAsUnset(z.string().min(1).optional()),
  WA_AGENT_PROPOSAL_TEMPLATE: blankAsUnset(z.string().min(1).optional()),
  WA_AGENT_PROPOSAL_LANGUAGE: z.string().min(1).default('en'),
  WA_AGENT_BASE_URL: z.string().url().default('https://api.waagent.in/v1'),
  /** Expo Push Service access token. Optional: pushes work without it unless enhanced security is on in Expo. */
  EXPO_ACCESS_TOKEN: blankAsUnset(z.string().min(1).optional()),
  /** Demo only: every code is 123456. Refused in production. */
  OTP_DEV_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  /**
   * The business's own timezone (IANA name). A to-do "due on the 14th" is overdue when the 14th has
   * ended HERE, not in UTC. Default: India.
   */
  BUSINESS_TIMEZONE: z
    .string()
    .min(1)
    .default('Asia/Kolkata')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Not a valid timezone name'),

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
  /** A complaint still Open/Assigned after this long → "overdue" reminder (once). */
  REMINDER_COMPLAINT_DAYS: z.coerce.number().positive().default(3),
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
if (env.NODE_ENV === 'production' && env.OTP_DEV_MODE) {
  console.error('OTP_DEV_MODE must not be enabled in production.');
  process.exit(1);
}
export const isProduction = env.NODE_ENV === 'production';
