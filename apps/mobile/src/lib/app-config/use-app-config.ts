import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AppConfigDto } from '@vastu/contracts';
import { ApiError, request } from '@/lib/api/client';
import { queryClient } from '@/lib/query/client';
import { appConfigStore, useAppConfigState } from './store';
import { isOlder } from './version';

export const APP_VERSION = Constants.expoConfig?.version ?? '0';
/** Do not ask more often than this when the app returns to the foreground. */
const REFRESH_MS = 5 * 60_000;

type Gate = 'update-required' | 'maintenance' | null;

/** What blocks the app right now. Soft recommendations never block. */
export function useAppGate(): Gate {
  const { config, forced } = useAppConfigState();
  if (forced) return 'update-required';
  if (config?.maintenance.active) return 'maintenance';
  return null;
}

/** Fetches the app config. Any failure (offline, timeout, 5xx) is silently ignored: never block. */
export async function refreshAppConfig(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    const config = await request<AppConfigDto>(
      'GET',
      `/app/config?platform=${Platform.OS}`,
      undefined,
      { anonymous: true, timeoutMs: 8_000 },
    );
    appConfigStore.setConfig(
      config,
      isOlder(APP_VERSION, config.minVersion)
        ? { minVersion: config.minVersion, storeUrl: config.storeUrl, apkUrl: config.apkUrl }
        : null,
    );
  } catch {
    // keep whatever we knew before
  }
}

/**
 * Mount once, in the root layout. Fetches at launch and when the app returns to the foreground,
 * and turns a 426 UPGRADE_REQUIRED from any query into the force-update screen.
 */
export function useAppConfigBootstrap(): void {
  useEffect(() => {
    void refreshAppConfig();
    let last = Date.now();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - last > REFRESH_MS) {
        last = Date.now();
        void refreshAppConfig();
      }
    });
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      const err = event.query.state.error;
      if (err instanceof ApiError && err.status === 426) {
        const d = (err.data ?? {}) as {
          minVersion?: string;
          storeUrl?: string | null;
          apkUrl?: string | null;
        };
        appConfigStore.force({
          minVersion: d.minVersion ?? '',
          storeUrl: d.storeUrl ?? null,
          apkUrl: d.apkUrl ?? null,
        });
      }
    });
    return () => {
      sub.remove();
      unsub();
    };
  }, []);
}
