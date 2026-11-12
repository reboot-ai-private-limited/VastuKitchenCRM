import * as SQLite from 'expo-sqlite';

let opened: Promise<SQLite.SQLiteDatabase> | null = null;
// One promise chain for every call: overlapping calls on one expo-sqlite connection are unsafe.
let chain: Promise<unknown> = Promise.resolve();

function open(): Promise<SQLite.SQLiteDatabase> {
  return (opened ??= (async () => {
    const d = await SQLite.openDatabaseAsync('vk-outbox.db');
    await d.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued','sending')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        captured_at INTEGER NOT NULL,
        created_seq INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outbox_user ON outbox(user_id, created_seq);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    return d;
  })());
}

/** Run `fn` against the database, strictly one call at a time. */
export function db<T>(fn: (d: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const run = chain.then(async () => fn(await open()));
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
