/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from 'mongoose';
import { env } from '@/config/env.js';
import { buildIdentityContainer } from '@/modules/identity/identity.container.js';
import { DEMO_TARGETS, targetMonths } from './demo-targets.js';

/**
 * Adds the demo staff's monthly sales targets to a database that already has them. Safe to run
 * again: it just sets the same amounts. Needs the API running and an Admin sign-in.
 *
 *   pnpm --filter @vastu/api seed:targets
 *   (DEMO_ADMIN_PHONE / DEMO_ADMIN_PASSWORD, default: the demo owner)
 */
const API = process.env['DEMO_API_URL'] ?? `http://localhost:${env.PORT}/api`;

async function call(method: string, path: string, token?: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.message ?? ''}`);
  return json.data;
}

async function main() {
  if (env.NODE_ENV === 'production') throw new Error('Demo data is never seeded in production.');
  await mongoose.connect(env.MONGO_URI);
  buildIdentityContainer(); // registers the User model
  const phone = process.env['DEMO_ADMIN_PHONE'] ?? '9000000001';
  const password = process.env['DEMO_ADMIN_PASSWORD'] ?? 'demo-admin-123';
  const { accessToken } = await call('POST', '/identity/auth/login', undefined, {
    phone,
    password,
  });
  const users = await mongoose.model('User').find({ phone: { $in: Object.keys(DEMO_TARGETS) } });
  const months = targetMonths();
  for (const u of users) {
    const amounts = DEMO_TARGETS[String(u.get('phone'))]!;
    for (const [i, month] of months.entries())
      await call('PUT', `/targets/${month}/users/${u.id}`, accessToken, { amount: amounts[i] });
  }
  console.warn(`Set targets for ${users.length} people for ${months.join(' and ')}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
