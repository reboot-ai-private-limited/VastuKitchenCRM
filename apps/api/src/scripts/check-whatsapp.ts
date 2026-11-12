import { env } from '@/config/env.js';

/**
 * Verifies the WhatsApp (WA AGENT) setup with the values in `.env`, WITHOUT sending any message:
 *   pnpm --filter @vastu/api check:whatsapp
 *
 * Checks the key works, that the sending number is on the account and sendable, and that the login-code
 * and proposal templates exist, are APPROVED, and expose the slots the app fills (`code`; `body.1`,
 * `body.2`, `body.3`, `button.0.1`). Exits non-zero on a failure.
 */
let failures = 0;
const ok = (label: string, detail = '') =>
  console.warn(`  ok    ${label}${detail ? `  (${detail})` : ''}`);
const bad = (label: string, detail = '') => {
  failures++;
  console.warn(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
};

interface Template {
  id: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  variables?: string[];
}
interface Num {
  phone_number_id?: string;
  status?: string;
  sendable?: boolean;
  display_phone_number?: string;
}

const base = env.WA_AGENT_BASE_URL;
const headers = { Authorization: `Bearer ${env.WA_AGENT_API_KEY}` };
const asList = <T>(body: unknown): T[] => {
  if (Array.isArray(body)) return body as T[];
  const o = body as { data?: unknown; items?: unknown; templates?: unknown; numbers?: unknown };
  for (const v of [o?.data, o?.items, o?.templates, o?.numbers])
    if (Array.isArray(v)) return v as T[];
  return [];
};

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(15_000) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  console.warn(`WA AGENT at ${base}\n`);
  if (!env.WA_AGENT_API_KEY) {
    bad('WA_AGENT_API_KEY is not set', 'put the wa_live_… key in apps/api/.env');
    return;
  }

  console.warn('Sending number');
  const nums = await get('/numbers');
  if (nums.status !== 200) bad('GET /numbers', `HTTP ${nums.status}: the key is wrong or revoked`);
  else {
    const list = asList<Num>(nums.body);
    const mine = list.find((n) => n.phone_number_id === env.WA_AGENT_PHONE_NUMBER_ID);
    if (!env.WA_AGENT_PHONE_NUMBER_ID) bad('WA_AGENT_PHONE_NUMBER_ID is not set');
    else if (!mine)
      bad(
        'phone number id not on this account',
        `set it to one of: ${list.map((n) => n.phone_number_id).join(', ') || '(none)'}`,
      );
    else if (mine.sendable === false || (mine.status && mine.status !== 'sendable'))
      bad('number cannot send right now', `status ${mine.status ?? 'unknown'}`);
    else ok('number is connected and sendable', mine.display_phone_number ?? mine.phone_number_id);
  }

  console.warn('\nTemplates');
  const tpls = await get('/templates');
  if (tpls.status !== 200) {
    bad('GET /templates', `HTTP ${tpls.status}`);
    return;
  }
  const templates = asList<Template>(tpls.body);
  const check = (
    label: string,
    id: string | undefined,
    name: string | undefined,
    slots: string[],
  ) => {
    const t = templates.find((x) => (id ? x.id === id : x.name === name));
    if (!id && !name)
      return bad(`${label}: no template configured`, 'set its *_TEMPLATE_ID in .env');
    if (!t) return bad(`${label}: template not found`, id ?? name);
    if (t.status !== 'APPROVED') return bad(`${label}: not approved yet`, `status ${t.status}`);
    ok(`${label}: approved`, `${t.name} · ${t.language} · ${t.category}`);
    const have = new Set(t.variables ?? []);
    if (have.size > 0) {
      const missing = slots.filter((s) => !have.has(s));
      if (missing.length > 0) bad(`${label}: missing slots`, missing.join(', '));
      else ok(`${label}: slots match`, slots.join(', '));
    }
  };
  check('Login code', env.WA_AGENT_OTP_TEMPLATE_ID, env.WA_AGENT_OTP_TEMPLATE, ['code']);
  check('Proposal link', env.WA_AGENT_PROPOSAL_TEMPLATE_ID, env.WA_AGENT_PROPOSAL_TEMPLATE, [
    'body.1',
    'body.2',
    'body.3',
    'button.0.1',
  ]);
}

void main()
  .catch((err) => bad('could not reach WA AGENT', err instanceof Error ? err.message : String(err)))
  .finally(() => {
    console.warn(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
    process.exit(failures === 0 ? 0 : 1);
  });
