/**
 * Offline outbox (docs/mobile/05-offline-and-sync.md, section 3).
 *
 * A durable, per-user queue of small write commands in expo-sqlite. Callers
 * enqueue instead of calling the API; the drain loop sends rows in order and
 * retries until the server answers.
 *
 * Using it from other code (calls, visits, chat photos ...):
 *   1. registerOutboxHandler('visit.log', { send: (payload, ctx) => api(...), invalidate: [['leads']] })
 *      once at module load (see handlers.ts). `send` must throw ApiError / NetworkError
 *      (use lib/api/client).
 *   2. await enqueueOutbox({ type: 'visit.log', entityKey: `lead:${id}`, payload })
 *      returns the row immediately; a drain is kicked off at once.
 *   3. Show state with usePendingOutbox(filter) and <PendingSyncBadge />.
 *
 * Rules:
 *   - `ctx.id` is the row's UUID, made at tap time and stable across retries: use it as the
 *     idempotency key where the server supports one. `ctx.capturedAt` is the real event time.
 *   - Rows with the same `entityKey` replay strictly in order (a waiting row blocks later ones).
 *   - Network error / 408 / 425 / 429 / 5xx / 401: retried with exponential backoff, up to 50
 *     attempts or 24 h, then dropped. Any other 4xx is permanent: the row is dropped at once and
 *     `onOutboxDropped` listeners are told (so the UI can say why).
 *   - Rows belong to the signed-in user and are only sent by that user's session.
 *   - Payloads must be small JSON. No media bytes (a later phase adds file refs).
 */
import { useSyncExternalStore } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { ApiError, NetworkError } from '@/lib/api/client';
import { queryClient } from '@/lib/query/client';
import { session } from '@/lib/auth/session';
import { db, newId } from './db';

export type OutboxItem = {
  id: string;
  userId: string;
  type: string;
  entityKey: string;
  payload: unknown;
  status: 'queued' | 'sending';
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  capturedAt: number;
  createdSeq: number;
};

export type OutboxContext = { id: string; capturedAt: number; attempts: number };

export type OutboxHandler<P = unknown> = {
  send: (payload: P, ctx: OutboxContext) => Promise<unknown>;
  /** Query key families to invalidate once a row of this type is done or dropped. */
  invalidate?: QueryKey[];
  /** Human name used in "could not sync" messages, e.g. 'Visit check-in'. */
  label?: string;
  /**
   * Default true. Set false for non-idempotent writes (visit.log): after an ambiguous failure
   * (timeout, 5xx, dropped connection while online) or an app kill mid-send, the row is dropped and
   * the user is told it MAY have been saved, instead of being replayed and possibly duplicated.
   */
  idempotent?: boolean;
};

const MAX_ATTEMPTS = 50;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

const handlers = new Map<string, OutboxHandler<never>>();
export function registerOutboxHandler<P>(type: string, handler: OutboxHandler<P>) {
  handlers.set(type, handler as OutboxHandler<never>);
}

type Row = {
  id: string;
  user_id: string;
  type: string;
  entity_key: string;
  payload: string;
  status: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  captured_at: number;
  created_seq: number;
};

const toItem = (r: Row, payload: unknown): OutboxItem => ({
  id: r.id,
  userId: r.user_id,
  type: r.type,
  entityKey: r.entity_key,
  payload,
  status: r.status === 'sending' ? 'sending' : 'queued',
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  lastError: r.last_error,
  capturedAt: r.captured_at,
  createdSeq: r.created_seq,
});

// ---- observable snapshot (the pending rows of the signed-in user) ----------------------------
const EMPTY: readonly OutboxItem[] = [];
let snapshot: readonly OutboxItem[] = EMPTY;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export async function refreshOutboxSnapshot(): Promise<void> {
  const userId = session.getState().user?.id;
  const rows = userId
    ? await db((d) =>
        d.getAllAsync<Row>('SELECT * FROM outbox WHERE user_id = ? ORDER BY created_seq', userId),
      )
    : [];
  const items: OutboxItem[] = [];
  for (const r of rows) {
    try {
      items.push(toItem(r, JSON.parse(r.payload) as unknown));
    } catch {
      // corrupt row: the drain loop quarantines it; keep it out of the UI meanwhile
    }
  }
  snapshot = items.length ? items : EMPTY;
  listeners.forEach((l) => l());
}

/** Pending (not yet confirmed by the server) rows of the current user, optionally filtered. */
export function usePendingOutbox(filter?: (i: OutboxItem) => boolean): OutboxItem[] {
  const all = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
  return filter ? all.filter(filter) : [...all];
}

// ---- dropped notifications ------------------------------------------------------------------
export type OutboxDropError = {
  status?: number;
  message: string;
  /** Server error body data (e.g. { existingLeadId } on a 409). */
  data?: unknown;
  /** True when the server may have applied the write (non-idempotent row, unknown outcome). */
  ambiguous?: boolean;
};
type DropListener = (item: OutboxItem, error: OutboxDropError) => void;
const dropListeners = new Set<DropListener>();
export function onOutboxDropped(l: DropListener) {
  dropListeners.add(l);
  return () => {
    dropListeners.delete(l);
  };
}

// ---- enqueue ----------------------------------------------------------------------------------
export async function enqueueOutbox<P>(input: {
  type: string;
  entityKey: string;
  payload: P;
  /** Real event time, epoch ms. Defaults to now. */
  capturedAt?: number;
}): Promise<OutboxItem> {
  const userId = session.getState().user?.id;
  if (!userId) throw new Error('Not signed in');
  const now = Date.now();
  const id = newId();
  const row = await db(async (d) => {
    await d.withTransactionAsync(async () => {
      const m = await d.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'seq'");
      const seq = Number(m?.value ?? 0) + 1;
      await d.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('seq', ?)", String(seq));
      await d.runAsync(
        `INSERT INTO outbox (id, user_id, type, entity_key, payload, status, attempts, next_attempt_at,
           captured_at, created_seq, created_at) VALUES (?, ?, ?, ?, ?, 'queued', 0, 0, ?, ?, ?)`,
        id,
        userId,
        input.type,
        input.entityKey,
        JSON.stringify(input.payload),
        input.capturedAt ?? now,
        seq,
        now,
      );
    });
    return d.getFirstAsync<Row>('SELECT * FROM outbox WHERE id = ?', id);
  });
  await refreshOutboxSnapshot();
  void drainOutbox();
  return toItem(row!, input.payload);
}

export async function discardOutboxItem(id: string): Promise<void> {
  await db((d) => d.runAsync('DELETE FROM outbox WHERE id = ?', id));
  await refreshOutboxSnapshot();
}

// ---- drain ------------------------------------------------------------------------------------
let draining: Promise<void> | null = null;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const isRetryable = (e: unknown) => {
  if (e instanceof NetworkError) return true;
  // Anything else that is not an HTTP verdict is a bug in a handler: retrying will not fix it.
  if (!(e instanceof ApiError)) return false;
  const s = e.status;
  return s === 401 || s === 408 || s === 425 || s === 429 || s >= 500;
};
const backoff = (attempts: number, e?: unknown) => {
  const base =
    Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(attempts, 10)) * (0.75 + Math.random() * 0.5);
  // Honour Retry-After on 429/503 when the API client exposes it as retryAfterMs on the error.
  const ra =
    e instanceof ApiError && (e.status === 429 || e.status === 503)
      ? (e as ApiError & { retryAfterMs?: number }).retryAfterMs
      : undefined;
  return typeof ra === 'number' && ra > 0 ? Math.min(Math.max(ra, base), 60 * 60_000) : base;
};

/** Reset backoff so everything is tried now (call on reconnect / foreground). */
export async function retryOutboxNow(): Promise<void> {
  await db((d) => d.runAsync("UPDATE outbox SET next_attempt_at = 0 WHERE status = 'queued'"));
  void drainOutbox();
}

/** Return rows left in 'sending' by a killed app to the queue. Call once at boot. */
export async function recoverOutbox(): Promise<void> {
  const stuck = await db((d) => d.getAllAsync<Row>("SELECT * FROM outbox WHERE status = 'sending'"));
  for (const r of stuck) {
    if (handlers.get(r.type)?.idempotent !== false) continue;
    // Killed mid-send: unknown whether the server got it. Never replay a non-idempotent write.
    await db((d) => d.runAsync('DELETE FROM outbox WHERE id = ?', r.id));
    try {
      const item = toItem(r, JSON.parse(r.payload) as unknown);
      dropListeners.forEach((l) => l(item, { message: 'The app closed while sending.', ambiguous: true }));
    } catch {
      // corrupt payload, nothing to report
    }
  }
  await db((d) => d.runAsync("UPDATE outbox SET status = 'queued' WHERE status = 'sending'"));
  await refreshOutboxSnapshot();
}

async function isOnline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return s.isConnected === true && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function drainOutbox(): Promise<void> {
  if (draining) {
    rerun = true;
    return draining;
  }
  draining = (async () => {
    try {
      do {
        rerun = false;
        await drainPass();
      } while (rerun);
    } finally {
      draining = null;
    }
  })();
  return draining;
}

async function drainPass(): Promise<void> {
  const userId = session.getState().user?.id;
  if (!userId || session.getState().status !== 'signedIn') return;
  if (timer) clearTimeout(timer);
  timer = null;

  const blocked = new Set<string>(); // entity keys with an earlier row that is still waiting
  const touched = new Set<string>();
  const rows = await db((d) =>
    d.getAllAsync<Row>('SELECT * FROM outbox WHERE user_id = ? ORDER BY created_seq', userId),
  );
  let earliest = Infinity;

  for (const r of rows) {
    if (blocked.has(r.entity_key)) continue;
    if (r.next_attempt_at > Date.now()) {
      blocked.add(r.entity_key);
      earliest = Math.min(earliest, r.next_attempt_at);
      continue;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(r.payload) as unknown;
    } catch {
      // Corrupt row: drop it so it cannot stall the queue.
      await db((d) => d.runAsync('DELETE FROM outbox WHERE id = ?', r.id));
      dropListeners.forEach((l) =>
        l(toItem(r, null), { message: 'A saved change was damaged and could not be sent.' }),
      );
      continue;
    }
    const item = toItem(r, payload);
    const h = handlers.get(r.type);
    if (!h) {
      blocked.add(r.entity_key); // unknown type (older/newer build): keep it, do not lose data
      continue;
    }
    // The session may have changed or expired while earlier rows were sending.
    const st = session.getState();
    if (st.status !== 'signedIn' || st.user?.id !== userId) break;
    if (h.idempotent === false && !(await isOnline())) {
      // Offline: not an attempt, just wait for the connection (retryOutboxNow fires on reconnect).
      blocked.add(r.entity_key);
      earliest = Math.min(earliest, Date.now() + 30_000);
      continue;
    }
    await db((d) => d.runAsync("UPDATE outbox SET status = 'sending' WHERE id = ?", r.id));
    try {
      await h.send(item.payload as never, { id: r.id, capturedAt: r.captured_at, attempts: r.attempts });
      await db((d) => d.runAsync('DELETE FROM outbox WHERE id = ?', r.id));
      h.invalidate?.forEach((k) => touched.add(JSON.stringify(k)));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed';
      const attempts = r.attempts + 1;
      const expired = attempts >= MAX_ATTEMPTS || Date.now() - r.captured_at > MAX_AGE_MS;
      const ambiguous =
        h.idempotent === false && (e instanceof NetworkError || (e instanceof ApiError && e.status >= 500));
      if (!isRetryable(e) || expired || ambiguous) {
        await db((d) => d.runAsync('DELETE FROM outbox WHERE id = ?', r.id));
        h.invalidate?.forEach((k) => touched.add(JSON.stringify(k)));
        const status = e instanceof ApiError ? e.status : undefined;
        const data = e instanceof ApiError ? e.data : undefined;
        dropListeners.forEach((l) => l(item, { status, message, data, ambiguous }));
      } else {
        const next = Date.now() + backoff(attempts, e);
        await db((d) =>
          d.runAsync(
            "UPDATE outbox SET status = 'queued', attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?",
            attempts,
            next,
            message,
            r.id,
          ),
        );
        blocked.add(r.entity_key);
        earliest = Math.min(earliest, next);
      }
    }
    await refreshOutboxSnapshot();
  }

  await refreshOutboxSnapshot();
  touched.forEach((k) => void queryClient.invalidateQueries({ queryKey: JSON.parse(k) as QueryKey }));
  if (Number.isFinite(earliest)) {
    timer = setTimeout(() => void drainOutbox(), Math.max(1_000, earliest - Date.now()));
  }
}
