import { clearSession, getAccessToken, hasFreshToken, refreshAccessToken } from './session';

/** What the API said went wrong, in a shape forms can use. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** `path.to.field` → message, from the API's 400 `data[]`. */
  readonly fieldErrors: Record<string, string>;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.fieldErrors = {};
    if (Array.isArray(details)) {
      for (const d of details as Array<{ path?: unknown; message?: unknown }>) {
        if (Array.isArray(d.path) && typeof d.message === 'string') {
          this.fieldErrors[d.path.join('.')] ??= d.message;
        }
      }
    }
  }

  /** The API hides records you may not see as 404; 403 means your role may never do this. */
  get isNotFound(): boolean {
    return this.status === 404 || this.status === 403;
  }
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  code?: string;
  data?: T;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Public endpoints (login, invite, public proposal) send no token and never refresh. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

export function withQuery(path: string, query?: RequestOptions['query']): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'X-Client': 'web' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`/api${withQuery(path, opts.query)}`, {
    method: opts.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
}

async function toError(res: Response): Promise<ApiError> {
  let body: Envelope<unknown> | null = null;
  try {
    body = (await res.json()) as Envelope<unknown>;
  } catch {
    /* not JSON (proxy error page etc.) */
  }
  return new ApiError(
    res.status,
    body?.code ?? 'HTTP_ERROR',
    body?.message ??
      (res.status >= 500
        ? 'Something went wrong on our side. Please try again.'
        : 'Request failed.'),
    body?.data,
  );
}

/**
 * Calls the API under `/api` and returns `data`. Adds the bearer token, refreshes it before it
 * expires, and on a 401 refreshes once and retries once. Throws `ApiError`.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let token: string | null = null;
  if (!opts.anonymous) {
    token = hasFreshToken() ? getAccessToken() : await refreshAccessToken();
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }

  let res: Response;
  try {
    res = await send(path, opts, token);
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Connection lost. Check your internet and try again.');
  }

  if (res.status === 401 && !opts.anonymous) {
    const fresh = await refreshAccessToken(token);
    if (!fresh) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
    try {
      res = await send(path, opts, fresh);
    } catch {
      throw new ApiError(0, 'NETWORK', 'Connection lost. Check your internet and try again.');
    }
    if (res.status === 401) {
      clearSession(true);
      throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as Envelope<T>;
  return body.data as T;
}

/** For downloads that need the bearer header (e.g. the salary CSV): returns a Blob. */
export async function apiBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  const token = hasFreshToken() ? getAccessToken() : await refreshAccessToken();
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  const res = await send(path, opts, token);
  if (!res.ok) throw await toError(res);
  return res.blob();
}
