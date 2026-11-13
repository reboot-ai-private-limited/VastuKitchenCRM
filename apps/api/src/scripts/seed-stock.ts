/* eslint-disable @typescript-eslint/no-explicit-any */
import { env } from '@/config/env.js';
import { DEMO_STOCK } from './demo-stock.js';

/**
 * Adds the demo stock (about 30 items with a little history) to a database that already exists.
 * Safe to run again: an item whose name is already there is left alone. Needs the API running and
 * an Admin sign-in.
 *
 *   pnpm --filter @vastu/api seed:stock
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
  const phone = process.env['DEMO_ADMIN_PHONE'] ?? '9000000001';
  const password = process.env['DEMO_ADMIN_PASSWORD'] ?? 'demo-admin-123';
  const { accessToken } = await call('POST', '/identity/auth/login', undefined, {
    phone,
    password,
  });

  const existing = new Set<string>();
  for (let page = 1; ; page++) {
    const r = await call(
      'GET',
      `/stocks/items?page=${page}&pageSize=100&includeArchived=true`,
      accessToken,
    );
    for (const i of r.items) existing.add(i.name);
    if (page >= r.totalPages) break;
  }

  let created = 0;
  for (const { moves, ...item } of DEMO_STOCK) {
    if (existing.has(item.name)) continue;
    const made = await call('POST', '/stocks/items', accessToken, item);
    for (const [type, quantity, note] of moves)
      await call('POST', `/stocks/items/${made.id}/movements`, accessToken, {
        type,
        quantity,
        note,
      });
    created++;
  }
  const s = await call('GET', '/stocks/summary', accessToken);
  console.warn(
    `Added ${created} items (${DEMO_STOCK.length - created} already there). Now ${s.total} items: ${s.low} low, ${s.out} out.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
