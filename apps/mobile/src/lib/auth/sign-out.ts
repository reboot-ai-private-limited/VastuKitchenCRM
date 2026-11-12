import { Alert } from 'react-native';
import { logout } from '@/lib/api/endpoints/auth';
import { session } from '@/lib/auth/session';
import { usePendingOutbox } from '@/offline';
import { queryClient } from '@/lib/query/client';

/** Clears the local session first, then revokes the refresh token in the background. */
export async function signOut(): Promise<void> {
  const rt = session.refreshToken();
  queryClient.clear();
  await session.clear();
  if (rt) void logout(rt).catch(() => undefined);
}

/** Confirm dialog, then signOut(). `pending` is the count of offline items not yet sent; it is warned about. */
export function confirmSignOut(onConfirm?: () => void, pending = 0): void {
  const warn =
    pending > 0
      ? `

${pending} item${pending === 1 ? '' : 's'} saved on this phone ha${pending === 1 ? 's' : 've'} not been sent yet. Signing out may lose ${pending === 1 ? 'it' : 'them'}.`
      : '';
  Alert.alert('Sign out?', `You will need to sign in again on this phone.${warn}`, [
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

/** Hook form of confirmSignOut that includes the unsent offline item count in the warning. */
export function useConfirmSignOut(): (onConfirm?: () => void) => void {
  const pending = usePendingOutbox().length;
  return (onConfirm) => confirmSignOut(onConfirm, pending);
}
