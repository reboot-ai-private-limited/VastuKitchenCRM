import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AuthTokensDto } from '@vastu/contracts';
import { API_URL } from '@/lib/config';
import { session } from '@/lib/auth/session';

type Issue = { path?: unknown; message?: string };

function retryAfterMs(res: Response): number | undefined {
  const h = res.headers.get('retry-after');
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs) * 1000;
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly data?: unknown,
    /** From the Retry-After header on 429/503, in ms. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }

  /** Field -> message map from VALIDATION_FAILED responses. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.code !== 'VALIDATION_FAILED' || !Array.isArray(this.data)) return out;
    for (const i of this.data as Issue[]) {
      if (!i || typeof i.message !== 'string') continue;
      const key = Array.isArray(i.path) ? i.path.join('.') : String(i.path ?? '');
      if (!(key in out)) out[key] = i.message;
    }
    return out;
  }
}
/** No HTTP response (offline, timeout). Never signs the user out. */
export class NetworkError extends Error {}

type Opts = {
  anonymous?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Extra headers, e.g. Idempotency-Key / X-Request-Id. */
  headers?: Record<string, string>;
};

const APP_VERSION = Constants.expoConfig?.version ?? '0';

async function send<T>(method: string, path: string, body: unknown, token: string | null, o: Opts) {
  if (o.signal?.aborted) throw new NetworkError('Request cancelled');
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  o.signal?.addEventListener('abort', onAbort);
  // The timeout covers headers AND the body read.
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 15_000);
  try {
    let res: Response;
    try {
      res = await fetch(API_URL + path, {
        method,
        signal: ctl.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Client': 'mobile',
          'X-App-Version': APP_VERSION,
          'X-Platform': Platform.OS,
          ...o.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new NetworkError('Cannot reach the server');
    }
    if (res.status === 204) return undefined as T;
    let json: { success?: boolean; code?: string; message?: string; data?: unknown } | null;
    try {
      json = await res.json();
    } catch {
      if (ctl.signal.aborted) throw new NetworkError('Cannot reach the server');
      json = null;
    }
    if (!res.ok || !json?.success) {
      const code = json?.code ?? 'HTTP_ERROR';
      const first = Object.values(new ApiError(res.status, code, '', json?.data).fieldErrors)[0];
      throw new ApiError(
        res.status,
        code,
        first ??
          json?.message ??
          (res.status >= 500 ? 'Something went wrong on our side' : 'Request failed'),
        json?.data,
        retryAfterMs(res),
      );
    }
    return json.data as T;
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', onAbort);
  }
}

let refreshing: Promise<boolean> | null = null;
function refreshTokens(): Promise<boolean> {
  return (refreshing ??= (async () => {
    const rt = session.refreshToken();
    if (!rt) return false;
    try {
      const next = await send<AuthTokensDto>('POST', '/identity/auth/refresh', { refreshToken: rt }, null, {});
      await session.setTokens(next);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await session.expire();
        return false;
      }
      throw e; // network errors keep the session
    }
  })().finally(() => {
    refreshing = null;
  }));
}

export async function request<T>(method: string, path: string, body?: unknown, o: Opts = {}): Promise<T> {
  if (o.anonymous) return send<T>(method, path, body, null, o);
  if (session.needsRefresh()) {
    if (!(await refreshTokens())) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
    }
  }
  try {
    return await send<T>(method, path, body, session.accessToken(), o);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code !== 'UNAUTHENTICATED') throw e;
    if (!(await refreshTokens())) throw e;
    return send<T>(method, path, body, session.accessToken(), o);
  }
}
