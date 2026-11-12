import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { router, type Href } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useSession } from '@/lib/auth/session';
import './handlers';
import {
  drainOutbox,
  onOutboxDropped,
  recoverOutbox,
  refreshOutboxSnapshot,
  retryOutboxNow,
  type OutboxDropError,
  type OutboxItem,
} from './outbox';

const LABEL: Record<string, string> = {
  'attendance.checkin': 'Check-in',
  'attendance.checkout': 'Check-out',
  'todo.complete': 'Task update',
  'todo.reopen': 'Task update',
  'call.record': 'Call log',
  'visit.log': 'Site visit',
  'lead.status': 'Lead status change',
  'lead.create': 'New lead',
};

/** Tell the user a queued change was rejected (or may not have been saved). */
function notifyDropped(item: OutboxItem, err: OutboxDropError) {
  const what = LABEL[item.type] ?? 'A change';
  const existing = (err.data as { existingLeadId?: unknown } | undefined)?.existingLeadId;
  if (item.type === 'lead.create' && err.status === 409 && typeof existing === 'string') {
    Alert.alert('Lead already exists', 'A lead with this phone number is already in the CRM, so the new one was not added.', [
      { text: 'Close', style: 'cancel' },
      { text: 'Open existing lead', onPress: () => router.push({ pathname: '/leads/[id]', params: { id: existing } } as Href) },
    ]);
    return;
  }
  if (err.ambiguous) {
    Alert.alert(`${what} not confirmed`, `${what} may or may not have been saved. Please check before doing it again.`);
    return;
  }
  Alert.alert(`${what} could not be saved`, err.message);
}


/** Mount once in the root layout: loads the queue and drains on sign-in, reconnect and foreground. */
export function useOutboxRunner() {
  const { status, user } = useSession();
  const userId = user?.id ?? null;

  // Surface permanent failures once, for the whole app.
  useEffect(() => onOutboxDropped(notifyDropped), []);

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
