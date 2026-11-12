import { Alert } from 'react-native';
import { logout } from '@/lib/api/endpoints/auth';
import { session } from '@/lib/auth/session';
import { queryClient } from '@/lib/query/client';

/** Clears the local session first, then revokes the refresh token in the background. */
export async function signOut(): Promise<void> {
  const rt = session.refreshToken();
  queryClient.clear();
  await session.clear();
  if (rt) void logout(rt).catch(() => undefined);
}

/** Confirm dialog, then signOut(). */
export function confirmSignOut(onConfirm?: () => void): void {
  Alert.alert('Sign out?', 'You will need to sign in again on this phone.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: () => {
        onConfirm?.();
        void signOut();
      },
    },
  ]);
}
