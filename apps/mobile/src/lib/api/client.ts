import type { AuthTokensDto } from '@vastu/contracts';
import { API_URL } from '@/lib/config';
import { session } from '@/lib/auth/session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}
/** No HTTP response (offline, timeout). Never signs the user out. */
export class NetworkError extends Error {}

type Opts = { anonymous?: boolean; timeoutMs?: number; signal?: AbortSignal };

async function send<T>(method: string, path: string, body: unknown, token: string | null, o: Opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 15_000);
  o.signal?.addEventListener('abort', () => ctl.abort());
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'mobile',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError('Cannot reach the server');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiError(
      res.status,
      json?.code ?? 'HTTP_ERROR',
      json?.message ?? (res.status >= 500 ? 'Something went wrong on our side' : 'Request failed'),
      json?.data,
    );
  }
  return json.data as T;
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
        await session.clear();
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
  if (session.needsRefresh()) await refreshTokens();
  try {
    return await send<T>(method, path, body, session.accessToken(), o);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code !== 'UNAUTHENTICATED') throw e;
    if (!(await refreshTokens())) throw e;
    return send<T>(method, path, body, session.accessToken(), o);
  }
}
