import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, withQuery } from './client';
import { getAccessToken, resetSessionForTests, setSession } from './session';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const success = (data: unknown) =>
  json(200, { success: true, statusCode: 200, message: 'OK', data });

beforeEach(() => {
  resetSessionForTests();
  setSession('tok-1', 900);
});
afterEach(() => vi.unstubAllGlobals());

describe('building requests', () => {
  it('adds a query string, skipping empty values', () => {
    expect(
      withQuery('/leads', { page: 2, search: '', status: 'NEW', stuck: undefined, x: null }),
    ).toBe('/leads?page=2&status=NEW');
    expect(withQuery('/leads')).toBe('/leads');
    expect(withQuery('/leads', { a: false })).toBe('/leads?a=false');
  });

  it('sends the bearer token and X-Client, calls under /api, and returns data', async () => {
    const f = vi.fn(async () => success({ id: 'x' }));
    vi.stubGlobal('fetch', f);
    expect(await api('/leads/x')).toEqual({ id: 'x' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/leads/x');
    const h = init.headers as Record<string, string>;
    expect(h['Authorization']).toBe('Bearer tok-1');
    expect(h['X-Client']).toBe('web');
  });

  it('sends a JSON body with a content type, and no token for anonymous calls', async () => {
    const f = vi.fn(async () => success({}));
    vi.stubGlobal('fetch', f);
    await api('/identity/auth/login', {
      method: 'POST',
      body: { phone: '9', password: 'p' },
      anonymous: true,
    });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const h = init.headers as Record<string, string>;
    expect(h['Authorization']).toBeUndefined();
    expect(h['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ phone: '9', password: 'p' }));
  });
});

describe('errors', () => {
  it('turns the envelope into an ApiError with field errors from the 400 details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(400, {
          success: false,
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Some settings are not valid.',
          data: [
            { path: ['values', 'hr.weeklyOff'], message: 'Use e.g. "SUN"' },
            { path: ['values', 'hr.weeklyOff'], message: 'second message ignored' },
            { path: ['phone'], message: 'Enter 10 digits' },
          ],
        }),
      ),
    );
    const err = await api('/settings', { method: 'PATCH', body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(400);
    expect(e.code).toBe('VALIDATION_FAILED');
    expect(e.message).toBe('Some settings are not valid.');
    expect(e.fieldErrors).toEqual({
      'values.hr.weeklyOff': 'Use e.g. "SUN"',
      phone: 'Enter 10 digits',
    });
  });

  it('treats 403 and 404 the same (the API hides what you may not see)', async () => {
    for (const status of [403, 404]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => json(status, { success: false, code: 'X', message: 'Not found.' })),
      );
      const e = (await api('/complaints/1').catch((x: unknown) => x)) as ApiError;
      expect(e.isNotFound).toBe(true);
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(409, { success: false, code: 'CONFLICT', message: 'Changed.' })),
    );
    expect(((await api('/x').catch((x: unknown) => x)) as ApiError).isNotFound).toBe(false);
  });

  it('gives a calm message when the server returns something that is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>bad gateway</html>', { status: 502 })),
    );
    const e = (await api('/x').catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(502);
    expect(e.message).toMatch(/our side/);
  });

  it('reports a dead connection as status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const e = (await api('/x').catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(0);
    expect(e.code).toBe('NETWORK');
  });
});

describe('an expired access token', () => {
  it('on a 401, refreshes once and retries once with the new token', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/identity/auth/refresh')
        return success({ accessToken: 'tok-2', expiresIn: 900 });
      const auth = (init?.headers as Record<string, string>)['Authorization'];
      return auth === 'Bearer tok-2'
        ? success({ ok: true })
        : json(401, { success: false, code: 'UNAUTHENTICATED', message: 'expired' });
    });
    vi.stubGlobal('fetch', f);

    expect(await api('/dashboard')).toEqual({ ok: true });
    expect(getAccessToken()).toBe('tok-2');
    expect(f.mock.calls.map((c) => c[0])).toEqual([
      '/api/dashboard',
      '/api/identity/auth/refresh',
      '/api/dashboard',
    ]);
  });

  it('several requests failing together share ONE refresh', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/identity/auth/refresh') {
        await new Promise((r) => setTimeout(r, 10));
        return success({ accessToken: 'tok-2', expiresIn: 900 });
      }
      const auth = (init?.headers as Record<string, string>)['Authorization'];
      return auth === 'Bearer tok-2'
        ? success({ ok: true })
        : json(401, { success: false, code: 'U', message: 'expired' });
    });
    vi.stubGlobal('fetch', f);

    await Promise.all([api('/a'), api('/b'), api('/c')]);
    expect(f.mock.calls.filter((c) => c[0] === '/api/identity/auth/refresh')).toHaveLength(1);
  });

  it('refreshes BEFORE sending when the token is about to expire', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'));
    resetSessionForTests();
    setSession('old', 60);
    vi.setSystemTime(new Date('2026-11-11T10:00:40Z')); // 20 s left
    const f = vi.fn(async (url: string) =>
      url === '/api/identity/auth/refresh'
        ? success({ accessToken: 'fresh', expiresIn: 900 })
        : success({}),
    );
    vi.stubGlobal('fetch', f);

    await api('/x');
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/api/identity/auth/refresh', '/api/x']);
    expect(
      ((f.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>)[
        'Authorization'
      ],
    ).toBe('Bearer fresh');
    vi.useRealTimers();
  });

  it('gives up with a sign-in error when the refresh is refused, and does not loop', async () => {
    const f = vi.fn(async (url: string) =>
      url === '/api/identity/auth/refresh'
        ? json(401, { success: false, code: 'U', message: 'no' })
        : json(401, { success: false, code: 'U', message: 'expired' }),
    );
    vi.stubGlobal('fetch', f);
    const e = (await api('/x').catch((x: unknown) => x)) as ApiError;
    expect(e.status).toBe(401);
    expect(f).toHaveBeenCalledTimes(2); // the request, then the refresh. No third call.
  });

  it('does not refresh for anonymous endpoints (a wrong password is a 401, not an expiry)', async () => {
    const f = vi.fn(async () =>
      json(401, {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect phone number or password.',
      }),
    );
    vi.stubGlobal('fetch', f);
    const e = (await api('/identity/auth/login', {
      method: 'POST',
      body: {},
      anonymous: true,
    }).catch((x: unknown) => x)) as ApiError;
    expect(e.message).toBe('Incorrect phone number or password.');
    expect(f).toHaveBeenCalledTimes(1);
  });
});
