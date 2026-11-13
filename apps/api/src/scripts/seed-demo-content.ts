/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from '@/config/env.js';
import { buildPdf } from './demo-pdf.js';
import { COMPLAINTS, DOCS, STORIES, type Img } from './demo-content.js';

/**
 * Tops up an EXISTING demo database with believable project chat (photos, comments, back-dated
 * over weeks), complaints with before/after photos and real PDF documents.
 *
 *   pnpm --filter @vastu/api seed:content            (add)
 *   pnpm --filter @vastu/api seed:content -- --dry-run
 *
 * Additive only: nothing is deleted, no user is touched (the real owners are never read), and a
 * post / complaint / file that is already there is skipped, so it is safe to run twice. It needs
 * the API running (it uses the real endpoints, and uploads photos to the configured storage) and
 * the demo staff from `seed:demo`. It only ever writes to the three demo projects.
 * On a production-mode API set ALLOW_DEMO_SEED=true.
 */
const API = process.env['DEMO_API_URL'] ?? `http://localhost:${env.PORT}/api`;
const STAFF_PASSWORD = 'demo-pass-123';
const DAY = 86_400_000;
const DRY = process.argv.includes('--dry-run');
/** `--only=chat|complaints|docs` limits the run to one section (default: all). */
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const want = (section: string) => ONLY === undefined || ONLY === section;
const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, 'demo-assets');

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
const login = async (phone: string, password: string): Promise<string> =>
  (await call('POST', '/identity/auth/login', undefined, { phone, password })).accessToken;

/** POST a file to a signed ticket and return what the storage answered. */
async function sendToStorage(ticket: any, name: string, bytes: Buffer, type: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries<string>(ticket.fields)) form.append(k, v);
  form.append(ticket.fileField, new Blob([new Uint8Array(bytes)], { type }), name);
  const res = await fetch(ticket.url, { method: 'POST', body: form });
  const body: any = await res.json();
  if (!res.ok || !body.public_id) throw new Error(`storage upload failed: ${JSON.stringify(body)}`);
  return body;
}

const manifest: Array<{ file: string; tags: string[] }> = existsSync(join(ASSETS, 'manifest.json'))
  ? JSON.parse(readFileSync(join(ASSETS, 'manifest.json'), 'utf8'))
  : [];
/** The n-th image carrying a tag (wraps round), so every story gets a fitting photo. */
const pick = (tag: string, n: number): string => {
  const hits = manifest.filter((m) => m.tags.includes(tag));
  if (hits.length === 0) throw new Error(`No demo image tagged "${tag}" (see demo-assets/manifest.json)`);
  return hits[n % hits.length]!.file;
};

async function main() {
  if (env.NODE_ENV === 'production' && process.env['ALLOW_DEMO_SEED'] !== 'true')
    throw new Error('Demo content is never added in production (set ALLOW_DEMO_SEED=true on the stage API).');
  if (manifest.length === 0) throw new Error('demo-assets/manifest.json is missing or empty.');

  const phones: Record<string, string> = {
    Dev: '9000000013', Sneha: '9000000014', Kiran: '9000000015', Tarun: '9000000016',
    Bikash: '9000000017', Rita: '9000000018', Anil: '9000000012',
  };
  const tok: Record<string, string> = {};
  for (const [name, phone] of Object.entries(phones)) tok[name] = await login(phone, STAFF_PASSWORD);
  tok['admin'] = await login(
    process.env['DEMO_ADMIN_PHONE'] ?? '9000000001',
    process.env['DEMO_ADMIN_PASSWORD'] ?? 'demo-admin-123',
  );

  const projects = (await call('GET', '/projects?pageSize=100', tok['admin'])).items as any[];
  const byName = (n: string) => projects.find((p) => p.name === n);
  const db = mongoose.connection;
  if (!DRY) await mongoose.connect(env.MONGO_URI);

  const uploaded = new Map<string, string>(); // `${projectId}|${file}` → publicId
  const image = async (token: string, signPath: string, signBody: unknown, projectId: string, file: string) => {
    const key = `${projectId}|${file}|${signPath}`;
    if (uploaded.has(key)) return { publicId: uploaded.get(key)! };
    const bytes = readFileSync(join(ASSETS, file));
    const ticket = await call('POST', signPath, token, signBody);
    const body = await sendToStorage(ticket, file, bytes, 'image/jpeg');
    uploaded.set(key, body.public_id);
    return { publicId: body.public_id as string };
  };

  let made = 0;
  const log = (s: string) => console.warn(s);

  // ── project chat ─────────────────────────────────────────────────────────
  for (const story of want('chat') ? STORIES : []) {
    const p = byName(story.project);
    if (!p) { log(`skip: project "${story.project}" not found`); continue; }
    const seen = new Set<string>();
    for (let before: string | undefined; ; ) {
      const page = await call('GET', `/projects/${p.id}/posts?limit=50${before ? `&before=${before}` : ''}`, tok['admin']);
      for (const item of page.items) if (item.text) seen.add(item.text);
      if (!page.nextCursor) break;
      before = page.nextCursor;
    }
    log(`Chat: ${story.project}`);
    for (const s of story.posts) {
      if (seen.has(s.text)) continue;
      if (DRY) { log(`  would post (${s.daysAgo}d ago, ${s.by}): ${s.text.slice(0, 60)}…`); continue; }
      const images: Array<{ publicId: string }> = [];
      for (const [i, im] of (s.images ?? []).entries())
        images.push(await image(tok[s.by]!, `/projects/${p.id}/uploads/sign`, undefined, p.id, pick(im.tag, im.n ?? i)));
      const created = await call('POST', `/projects/${p.id}/posts`, tok[s.by], {
        text: s.text, visibility: s.visibility ?? 'CLIENT', images,
      });
      const when = new Date(Date.now() - s.daysAgo * DAY);
      await db.collection('projectposts').updateOne({ _id: new mongoose.Types.ObjectId(created.id) }, { $set: { createdAt: when } });
      let gap = 1;
      for (const c of s.comments ?? []) {
        const cm = await call('POST', `/projects/${p.id}/posts/${created.id}/comments`, tok[c.by], { text: c.text });
        await db.collection('projectcomments').updateOne(
          { _id: new mongoose.Types.ObjectId(cm.id) },
          { $set: { createdAt: new Date(when.getTime() + gap++ * 3_600_000 * 3) } },
        );
      }
      made++;
    }
  }

  // ── complaints ───────────────────────────────────────────────────────────
  const existing = new Set<string>(
    !want('complaints') ? [] : ((await call('GET', '/complaints?pageSize=100', tok['admin'])).items as any[]).map((c) => c.description),
  );
  for (const c of want('complaints') ? COMPLAINTS : []) {
    const p = byName(c.project);
    if (!p || existing.has(c.description)) continue;
    log(`Complaint: ${c.description.slice(0, 50)}…`);
    if (DRY) continue;
    const imgs: Array<{ publicId: string }> = [];
    for (const [i, im] of c.images.entries())
      imgs.push(await image(tok[c.raisedBy]!, '/complaints/uploads/sign', { projectId: p.id }, p.id, pick(im.tag, im.n ?? i)));
    const raised = await call('POST', '/complaints', tok[c.raisedBy], { projectId: p.id, description: c.description, images: imgs });
    const at = new Date(Date.now() - c.daysAgo * DAY);
    await db.collection('complaints').updateOne({ _id: new mongoose.Types.ObjectId(raised.id) }, { $set: { createdAt: at } });
    if (c.assignTo) await call('POST', `/complaints/${raised.id}/assign`, tok['admin'], { assigneeId: (await userId(tok['admin']!, phones[c.assignTo]!)) });
    if (c.resolved) {
      const rimgs = [await image(tok[c.assignTo!]!, `/complaints/${raised.id}/uploads/sign`, undefined, p.id, pick(c.resolved.image.tag, c.resolved.image.n ?? 0))];
      await call('POST', `/complaints/${raised.id}/resolve`, tok[c.assignTo!], { note: c.resolved.note, images: rimgs });
    }
    made++;
  }

  // ── documents ────────────────────────────────────────────────────────────
  for (const d of want('docs') ? DOCS : []) {
    const p = byName(d.project);
    if (!p) continue;
    const listed = await call('GET', `/projects/${p.id}/files`, tok['admin']);
    const files: any[] = Array.isArray(listed) ? listed : (listed.items ?? []);
    if (files.some((f) => f.originalName === d.name)) continue;
    log(`Document: ${d.project} / ${d.name}`);
    if (DRY) continue;
    const fl = await call('GET', `/projects/${p.id}/folders`, tok['admin']);
    const folders: any[] = Array.isArray(fl) ? fl : (fl.items ?? []);
    let folder = folders.find((f) => f.name === d.folder);
    if (!folder) folder = await call('POST', `/projects/${p.id}/folders`, tok[d.by], { name: d.folder });
    const bytes = buildPdf(d.title, d.lines);
    const ticket = await call('POST', `/projects/${p.id}/files/uploads/sign`, tok[d.by]);
    const body = await sendToStorage(ticket, d.name, bytes, 'application/pdf');
    await call('POST', `/projects/${p.id}/files`, tok[d.by], {
      publicId: body.public_id, format: 'pdf', resourceType: body.resource_type, originalName: d.name, bytes: bytes.length,
      visibility: d.visibility, folderId: folder.id,
    });
    made++;
  }

  log(DRY ? 'Dry run: nothing written.' : `Done. ${made} item(s) added.`);
  if (!DRY) await mongoose.disconnect();
}

async function userId(adminToken: string, phone: string): Promise<string> {
  const users = await call('GET', '/identity/users?pageSize=100', adminToken);
  return (users.items ?? users).find((u: any) => u.phone === phone).id;
}

void main().catch((e) => { console.error(e); process.exit(1); });
export type { Img };
