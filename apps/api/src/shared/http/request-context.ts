import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request correlation state readable from any layer without threading it through signatures.
 * Deliberately narrow: a correlation channel, not a place to smuggle the user or a DB handle.
 */
export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Undefined outside a request (startup, shutdown) — callers must not assume a string. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
