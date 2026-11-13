import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { registerDevice, removeDevice } from '@/lib/api/endpoints/notifications';

// SecureStore keys allow only letters, digits, '.', '-', '_'.
const DEVICE_KEY = 'push.device'; // JSON { id, token, userId }
// Channel ids must match the backend (channelFor in pushFanout.ts); a push whose channel does not
// exist on the phone falls back to the default one.
const CHANNELS = [
  { id: 'general', name: 'General' },
  { id: 'sales', name: 'Leads & proposals' },
  { id: 'projects', name: 'Projects & files' },
] as const;

type Registered = { id: string; token: string; userId: string };

/** Show foreground pushes as a banner; the unread badge is refreshed by the hook. */
export function configurePushHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Android 13+ shows the permission prompt only once a channel exists, so this runs first. */
export async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        importance: AndroidImportance.HIGH,
      }),
    ),
  );
}

const read = async (): Promise<Registered | null> => {
  try {
    const raw = await SecureStore.getItemAsync(DEVICE_KEY);
    return raw ? (JSON.parse(raw) as Registered) : null;
  } catch {
    return null;
  }
};

/**
 * Asks for permission (once only; a refusal is respected and the in-app inbox still works), then
 * registers. Call it after a first meaningful event, never at launch.
 */
export async function askForPermission(userId: string): Promise<void> {
  if (!Device.isDevice) return;
  await ensureChannel();
  const res = await Notifications.requestPermissionsAsync();
  if (res.granted) await registerForPush(userId);
}

/** Registers this phone if permission is already granted. Never throws; never prompts. */
export async function registerForPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators and emulators cannot receive remote push
    if (Platform.OS !== 'android') return; // iOS needs APNs configured in Firebase first
    await ensureChannel();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    // Native FCM registration token, issued by the Firebase SDK (google-services.json).
    const { data } = await Notifications.getDevicePushTokenAsync();
    const token = String(data);
    const device = await registerDevice({
      platform: 'android',
      provider: 'fcm',
      pushToken: token,
      appVersion: Constants.expoConfig?.version,
      deviceName: Device.deviceName ?? undefined,
    });
    const saved: Registered = { id: device.id, token, userId };
    await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(saved));
  } catch {
    // Push is best effort; the inbox is the source of truth.
  }
}

let unregistering = false;
/** Forgets this phone on the server so the next person on it gets nothing. Best effort, short. */
export async function unregisterPush(): Promise<void> {
  if (unregistering) return;
  unregistering = true;
  try {
    const d = await read();
    if (!d) return;
    await Promise.race([
      removeDevice(d.id).catch(() => undefined),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
    await SecureStore.deleteItemAsync(DEVICE_KEY).catch(() => undefined);
  } finally {
    unregistering = false;
  }
}

export const setBadge = (n: number) => Notifications.setBadgeCountAsync(n).catch(() => undefined);
