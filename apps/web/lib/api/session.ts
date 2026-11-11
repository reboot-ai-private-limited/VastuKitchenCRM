/**
 * The browser-side session: the short-lived ACCESS token lives in memory only (never localStorage,
 * so a script injected into the page cannot steal a long-lived credential). The long-lived REFRESH
 * token is an httpOnly cookie the browser sends by itself.
 *
 * The API rotates the refresh token on every use and treats ANY second use of an old one as theft:
 * it signs the user out on every device. So refreshing must happen strictly one at a time:
 *   - within a tab: one in-flight refresh that every caller awaits (single flight);
 *   - across tabs: a Web Lock, so a second tab waits and then uses the cookie the first tab just
 *     received (cookies are shared by all tabs, so the chain stays valid);
 *   - never retry a refresh that failed on the network (the server may already have rotated).
 */

const REFRESH_URL = '/api/identity/auth/refresh';
const LOCK_NAME = 'vastu-refresh';
const CHANNEL_NAME = 'vastu-session';
/** Refresh this long before the token expires, so a request never goes out with a dead token. */
const EARLY_MS = 30_000;
/** A readable hint for the server-side redirect (it cannot see the httpOnly cookie). Not a credential. */
export const SESSION_HINT_COOKIE = 'vk_session';

export type SessionLostReason = 'expired' | 'network' | 'signed-out';

let accessToken: string | null = null;
let expiresAt = 0;
let inflight: Promise<string | null> | null = null;
const lostListeners = new Set<(reason: SessionLostReason) => void>();
let channel: BroadcastChannel | null = null;

export const getAccessToken = (): string | null => accessToken;

export function hasFreshToken(now = Date.now()): boolean {
  return accessToken !== null && now < expiresAt - EARLY_MS;
}

function writeHint(on: boolean): void {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${SESSION_HINT_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=2592000`
    : `${SESSION_HINT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (
    event: MessageEvent<{ type: string; token?: string; expiresAt?: number }>,
  ) => {
    const m = event.data;
    if (m.type === 'token' && m.token && m.expiresAt) {
      accessToken = m.token;
      expiresAt = m.expiresAt;
    } else if (m.type === 'signed-out') {
      accessToken = null;
      expiresAt = 0;
      lostListeners.forEach((fn) => fn('signed-out'));
    }
  };
  return channel;
}

export function setSession(token: string, expiresInSeconds: number): void {
  accessToken = token;
  expiresAt = Date.now() + expiresInSeconds * 1000;
  writeHint(true);
  getChannel()?.postMessage({ type: 'token', token, expiresAt });
}

/** Forgets the session in this tab. `broadcast` tells the other tabs too (a deliberate sign-out). */
export function clearSession(broadcast = false): void {
  accessToken = null;
  expiresAt = 0;
  writeHint(false);
  if (broadcast) getChannel()?.postMessage({ type: 'signed-out' });
}

export function onSessionLost(fn: (reason: SessionLostReason) => void): () => void {
  getChannel();
  lostListeners.add(fn);
  return () => lostListeners.delete(fn);
}

interface RefreshEnvelope {
  data?: { accessToken?: string; expiresIn?: number };
}

async function callRefresh(): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'X-Client': 'web' },
      credentials: 'same-origin',
    });
  } catch {
    // Offline, or the request died in flight. The server may or may not have rotated the cookie,
    // so a retry could be a replay that signs the user out everywhere: never retry.
    clearSession();
    lostListeners.forEach((fn) => fn('network'));
    return null;
  }
  if (!res.ok) {
    clearSession();
    lostListeners.forEach((fn) => fn('expired'));
    return null;
  }
  const body = (await res.json()) as RefreshEnvelope;
  const token = body.data?.accessToken;
  if (!token) {
    clearSession();
    lostListeners.forEach((fn) => fn('expired'));
    return null;
  }
  setSession(token, body.data?.expiresIn ?? 900);
  return token;
}

/**
 * A fresh access token, refreshing if needed. Safe to call from anywhere, any number of times at
 * once. `staleToken` is the token a failed request used: if another caller already replaced it,
 * the new one is returned without a second refresh.
 */
export function refreshAccessToken(staleToken?: string | null): Promise<string | null> {
  if (inflight) return inflight;

  const run = async (): Promise<string | null> => {
    // Another caller (or another tab, via the lock) may have refreshed while we waited.
    if (hasFreshToken() && (staleToken === undefined || accessToken !== staleToken))
      return accessToken;
    return callRefresh();
  };

  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  // `locks.request` resolves with whatever the callback resolves with.
  const guarded = locks
    ? (locks.request(LOCK_NAME, { mode: 'exclusive' }, run) as unknown as Promise<string | null>)
    : run();
  const shared = guarded.finally(() => {
    inflight = null;
  });
  inflight = shared;
  return shared;
}

/** Test hook: forget everything, as a fresh page load would. */
export function resetSessionForTests(): void {
  accessToken = null;
  expiresAt = 0;
  inflight = null;
  lostListeners.clear();
  channel = null;
}
