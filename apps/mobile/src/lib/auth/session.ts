import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { LoginResponseDto, UserDto } from '@vastu/contracts';

// SecureStore keys allow only letters, digits, '.', '-', '_'.
const RT_KEY = 'auth.refreshToken';
const USER_KEY = 'auth.user';
const EARLY_MS = 30_000;

type State = { status: 'booting' | 'signedOut' | 'signedIn'; user: UserDto | null };

let state: State = { status: 'booting', user: null };
let accessToken: string | null = null;
let expiresAt = 0;
let refreshToken: string | null = null;
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const session = {
  getState: () => state,
  accessToken: () => accessToken,
  refreshToken: () => refreshToken,
  needsRefresh: () => !accessToken || Date.now() >= expiresAt - EARLY_MS,

  /** Restore from SecureStore. Signed in immediately with the cached user (offline-first). */
  async restore() {
    const [rt, rawUser] = await Promise.all([
      SecureStore.getItemAsync(RT_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (!rt) return emit({ status: 'signedOut', user: null });
    refreshToken = rt;
    let user: UserDto | null = null;
    try {
      user = rawUser ? (JSON.parse(rawUser) as UserDto) : null;
    } catch {
      user = null;
    }
    emit(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
  },

  async set(res: LoginResponseDto) {
    // Persist the rotated refresh token BEFORE the new access token is used.
    if (res.refreshToken) {
      await SecureStore.setItemAsync(RT_KEY, res.refreshToken);
      refreshToken = res.refreshToken;
    }
    accessToken = res.accessToken;
    expiresAt = Date.now() + res.expiresIn * 1000;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user));
    emit({ status: 'signedIn', user: res.user });
  },

  async setTokens(t: { accessToken: string; refreshToken?: string; expiresIn: number }) {
    if (t.refreshToken) {
      await SecureStore.setItemAsync(RT_KEY, t.refreshToken);
      refreshToken = t.refreshToken;
    }
    accessToken = t.accessToken;
    expiresAt = Date.now() + t.expiresIn * 1000;
  },

  async updateUser(user: UserDto) {
    if (state.status !== 'signedIn') return;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    emit({ status: 'signedIn', user });
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    expiresAt = 0;
    await Promise.all([SecureStore.deleteItemAsync(RT_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    emit({ status: 'signedOut', user: null });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSession(): State {
  return useSyncExternalStore(subscribe, session.getState, session.getState);
}
