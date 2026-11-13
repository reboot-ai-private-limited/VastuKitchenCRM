import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Durable storage for the outbox. A JSON document in AsyncStorage (works in Expo Go, no native
 * build needed). The queue is small (a handful of field writes), so one document is plenty.
 */
export type Row = {
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

export type OutboxState = { seq: number; rows: Row[] };

const KEY = 'vk-outbox-v1';

let cache: OutboxState | null = null;
// One promise chain for every call so reads and writes never interleave.
let chain: Promise<unknown> = Promise.resolve();

async function load(): Promise<OutboxState> {
  if (cache) return cache;
  let state: OutboxState = { seq: 0, rows: [] };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OutboxState>;
      if (Array.isArray(parsed.rows)) state = { seq: Number(parsed.seq) || 0, rows: parsed.rows };
    }
  } catch {
    // unreadable store: start empty rather than blocking the app
  }
  cache = state;
  return state;
}

/**
 * Run `fn` against the outbox state, strictly one call at a time. The state is saved after `fn`
 * returns; if saving fails, the in-memory copy is dropped so the next call reloads from disk.
 */
export function db<T>(fn: (state: OutboxState) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const state = await load();
    const out = await fn(state);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      cache = null;
      throw e;
    }
    return out;
  });
  chain = run.catch(() => undefined);
  return run;
}

/** UUID v4 (Hermes may lack crypto.randomUUID). Only needs to be unique, not secret. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
