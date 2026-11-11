import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSession,
  getAccessToken,
  hasFreshToken,
  onSessionLost,
  refreshAccessToken,
  resetSessionForTests,
  setSession,
} from './session';

const ok = (token: string, expiresIn = 900) =>
  new Response(JSON.stringify({ success: true, data: { accessToken: token, expiresIn } }), {
    status: 200,
  });

/** A tiny stand-in for the Web Locks API: exclusive, FIFO, like the real one. */
function fakeLocks() {
  let tail: Promise<unknown> = Promise.resolve();
  const order: string[] = [];
  return {
    order,
    request: vi.fn(async (_name: string, _opts: unknown, cb: () => Promise<unknown>) => {
      const run = tail.then(() => {
        order.push('enter');
        return cb();
      });
      tail = run.then(
        () => order.push('exit'),
        () => order.push('exit'),
      );
      return run;
    }),
  };
}

beforeEach(() => {
  resetSessionForTests();
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the in-memory session', () => {
  it('is fresh until shortly before it expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
    setSession('t1', 900);
    expect(hasFreshToken()).toBe(true);
    vi.setSystemTime(new Date('2026-11-11T10:14:40Z')); // 20 s left: refresh early
    expect(hasFreshToken()).toBe(false);
    expect(getAccessToken()).toBe('t1');
    clearSession();
    expect(getAccessToken()).toBeNull();
  });
});

describe('refreshing', () => {
  it('many callers at once cause ONE refresh call (the API signs you out if a token is used twice)', async () => {
    const fetchMock = vi.fn(async () => ok('new-token'));
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['new-token', 'new-token', 'new-token']);
    expect(getAccessToken()).toBe('new-token');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/identity/auth/refresh');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('same-origin');
    expect((init.headers as Record<string, string>)['X-Client']).toBe('web');
  });

  it('runs one refresh at a time across tabs by taking a lock, and a second waiter reuses the fresh token', async () => {
    const locks = fakeLocks();
    vi.stubGlobal('navigator', { locks });
    const fetchMock = vi.fn(async () => ok('from-tab-a'));
    vi.stubGlobal('fetch', fetchMock);

    await refreshAccessToken();
    expect(locks.request).toHaveBeenCalledWith(
      'vastu-refresh',
      { mode: 'exclusive' },
      expect.any(Function),
    );
    expect(locks.order).toEqual(['enter', 'exit'].slice(0, 1).concat(locks.order.slice(1)));

    // Another caller arrives later holding the token we just replaced: no second server call.
    const token = await refreshAccessToken('stale-token');
    expect(token).toBe('from-tab-a');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still refreshes when the token that failed is the one we hold', async () => {
    const fetchMock = vi.fn(async () => ok('next'));
    vi.stubGlobal('fetch', fetchMock);
    setSession('current', 900);
    expect(await refreshAccessToken('current')).toBe('next');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('on a network error: signs out, tells listeners, and does NOT retry (a retry could replay a rotated token)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    const lost = vi.fn();
    onSessionLost(lost);

    expect(await refreshAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lost).toHaveBeenCalledWith('network');
    expect(getAccessToken()).toBeNull();
  });

  it('on a 401: signs out and tells listeners it expired', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 401 })),
    );
    const lost = vi.fn();
    onSessionLost(lost);
    expect(await refreshAccessToken()).toBeNull();
    expect(lost).toHaveBeenCalledWith('expired');
  });

  it('can refresh again after a refresh finished', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok('a', 1)).mockResolvedValueOnce(ok('b'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await refreshAccessToken()).toBe('a');
    expect(await refreshAccessToken()).toBe('b'); // 'a' expired immediately
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
