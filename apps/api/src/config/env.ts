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
