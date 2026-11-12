import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSession } from '@/lib/auth/session';
import './handlers';
import { drainOutbox, recoverOutbox, refreshOutboxSnapshot, retryOutboxNow } from './outbox';

/** Mount once in the root layout: loads the queue and drains on sign-in, reconnect and foreground. */
export function useOutboxRunner() {
  const { status, user } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (status !== 'signedIn' || !userId) {
      void refreshOutboxSnapshot();
      return;
    }
    void recoverOutbox().then(() => drainOutbox());
    let wasOnline: boolean | null = null;
    const unsubNet = NetInfo.addEventListener((s) => {
      const online = s.isConnected === true && s.isInternetReachable !== false;
      if (online && wasOnline !== true) void retryOutboxNow();
      wasOnline = online;
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void retryOutboxNow();
    });
    return () => {
      unsubNet();
      sub.remove();
    };
  }, [status, userId]);
}
