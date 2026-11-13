import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { NotificationRefDto } from '@vastu/contracts';
import { routeFor } from '@/features/alerts/route-for';
import { useUnreadCount } from '@/features/alerts/use-notifications';
import { markRead } from '@/lib/api/endpoints/notifications';
import { session, useSession } from '@/lib/auth/session';
import {
  askForPermission,
  configurePushHandling,
  ensureChannel,
  registerForPush,
  setBadge,
  unregisterPush,
} from './push';

/** Remote push does not exist in Expo Go (removed in SDK 53); everything else keeps working there. */
export const pushSupported = Constants.executionEnvironment !== 'storeClient';

if (pushSupported) configurePushHandling();

// Logout lives in two screens outside this feature; wrap session.clear once so the phone is
// unregistered (while the access token still works) before the session is wiped.
let wrapped = false;
function wrapLogout() {
  if (wrapped) return;
  wrapped = true;
  const original = session.clear.bind(session);
  session.clear = async () => {
    // Skip when the access token is stale (forced logout): unregistering would wait on a refresh
    // that is itself waiting on this clear.
    if (!session.needsRefresh()) await unregisterPush();
    await original();
  };
}

/** Renders nothing; mount once in the signed-in layout. Skipped in Expo Go. */
export function PushBoot() {
  if (!pushSupported) return null;
  return <PushRunner />;
}

function PushRunner() {
  usePush();
  return null;
}

/** Hook form; only call where push is supported. */
export function usePush() {
  const { user } = useSession();
  const qc = useQueryClient();
  const unread = useUnreadCount().data;
  const handled = useRef<string | null>(null);
  const userId = user?.id;

  useEffect(wrapLogout, []);

  // Channel first (the Android 13 prompt needs one); register silently if already allowed.
  // Re-register when the user changes or the token rotates.
  useEffect(() => {
    if (!userId) return;
    void ensureChannel();
    void registerForPush(userId);
    const sub = Notifications.addPushTokenListener(() => void registerForPush(userId));
    return () => sub.remove();
  }, [userId]);

  // Ask for notification permission right after sign-in (the OS only shows it while undetermined).
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const perm = await Notifications.getPermissionsAsync();
      // Android 13+ can report 'denied' before the first ask, so test canAskAgain, not 'undetermined'.
      if (!perm.granted && perm.canAskAgain) await askForPermission(userId).catch(() => undefined);
    })();
  }, [userId]);

  // The app icon badge follows the unread count.
  useEffect(() => {
    if (typeof unread === 'number') void setBadge(unread);
  }, [unread]);

  // A push arriving while the app is open refreshes the inbox and the count.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => sub.remove();
  }, [qc]);

  // A tap, from cold start, background or foreground. This layout only mounts when signed in, so
  // a tap while signed out is replayed (the last response is kept) once the person logs in.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || !user) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    // The backend sends flat string keys (FCM data is string-only).
    const data = response.notification.request.content.data as {
      notificationId?: string;
      refKind?: NotificationRefDto['kind'];
      refId?: string;
      postId?: string;
      projectId?: string;
    };
    const ref: NotificationRefDto | null =
      data.refKind && data.refId
        ? {
            kind: data.refKind,
            id: data.refId,
            ...(data.postId ? { postId: data.postId } : {}),
            ...(data.projectId ? { projectId: data.projectId } : {}),
          }
        : null;
    if (data.notificationId) {
      void markRead(data.notificationId)
        .then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))
        .catch(() => undefined);
    }
    // A role that cannot open the target, or a summary push, lands in the inbox.
    const href = routeFor(ref, user.role) ?? '/notifications';
    setTimeout(() => {
      try {
        router.push(href);
      } catch {
        // navigator not ready; the inbox still has it
      }
    }, 0);
  }, [response, user, qc]);
}
