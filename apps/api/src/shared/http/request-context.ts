import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request correlation state readable from any layer without threading it through signatures.
 * Deliberately narrow: a correlation channel, not a place to smuggle the user or a DB handle.
 */
export interface RequestContext {
  requestId: string;
  /** Mobile client identity, from the X-App-Version / X-Platform / X-App-Build headers (when sent). */
  appVersion?: string;
  appPlatform?: string;
  appBuild?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Undefined outside a request (startup, shutdown) — callers must not assume a string. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** Adds the mobile client's identity to the current request, so every log line carries it. */
export function setClientInfo(
  info: Pick<RequestContext, 'appVersion' | 'appPlatform' | 'appBuild'>,
): void {
  const store = storage.getStore();
  if (store) Object.assign(store, info);
}

/** The fields to stamp on log lines; empty outside a request. */
export function getLogContext(): Partial<RequestContext> {
  const s = storage.getStore();
  if (!s) return {};
  return {
    requestId: s.requestId,
    ...(s.appVersion ? { appVersion: s.appVersion } : {}),
    ...(s.appPlatform ? { appPlatform: s.appPlatform } : {}),
    ...(s.appBuild ? { appBuild: s.appBuild } : {}),
  };
}
