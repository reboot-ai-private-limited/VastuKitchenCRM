import { useSyncExternalStore } from 'react';
import type { AppConfigDto } from '@vastu/contracts';

export type ForcedUpdate = { minVersion: string; storeUrl: string | null; apkUrl: string | null };

type State = {
  /** Last config the server gave us. Null until the first successful fetch (and when offline). */
  config: AppConfigDto | null;
  /** Set by a 426 from any request, or by a config whose minVersion is above this build. */
  forced: ForcedUpdate | null;
  /** The soft "update available" banner was dismissed for this launch. */
  bannerDismissed: boolean;
};

let state: State = { config: null, forced: null, bannerDismissed: false };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const appConfigStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  setConfig(config: AppConfigDto, forced: ForcedUpdate | null) {
    set({ ...state, config, forced });
  },
  /** A 426 can only add a forced update; only a fresh config can clear it. */
  force(forced: ForcedUpdate) {
    set({ ...state, forced });
  },
  dismissBanner() {
    set({ ...state, bannerDismissed: true });
  },
};

export function useAppConfigState(): State {
  return useSyncExternalStore(appConfigStore.subscribe, appConfigStore.get, appConfigStore.get);
}
