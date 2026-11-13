import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { redeemInvite } from '@/lib/api/endpoints/auth';
import { session, useSession } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/sign-out';

type Problem = { kind: 'expired' | 'wait' | 'network' | 'other'; text: string };

function toProblem(e: unknown): Problem {
  if (e instanceof NetworkError) {
    return { kind: 'network', text: 'Connection lost. Check your internet and try again.' };
  }
  if (e instanceof ApiError) {
    if (e.code === 'RATE_LIMITED' || e.status === 429) {
      return { kind: 'wait', text: 'Too many attempts. Please wait a few minutes and try again.' };
    }
    if (e.code === 'TOKEN_INVALID') {
      return {
        kind: 'expired',
        text: 'This invite link has expired or was already used. Sign in with a code, or ask your coordinator for a new link.',
      };
    }
  }
  return { kind: 'other', text: 'Could not open the invite. Please try again.' };
}

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status } = useSession();
  const router = useRouter();
  const started = useRef(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const t = Array.isArray(token) ? token[0] : token;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // One-time token: redeem exactly once per attempt (guards double effects / re-renders).
    if (status !== 'signedOut' || started.current) return;
    started.current = true;
    if (!t) return;
    redeemInvite(t)
      .then((res) => session.set(res))
      .catch((e: unknown) => setProblem(toProblem(e)));
  }, [t, attempt, status]);

  const retry = () => {
    started.current = false;
    setProblem(null);
    setAttempt((n) => n + 1);
  };

  if (status === 'signedIn') {
    return (
      <View style={styles.root}>
        <Text variant="section">You are already signed in</Text>
        <Text muted style={{ textAlign: 'center' }}>
          To use this invite link, sign out of the current account first.
        </Text>
        <Button title="Sign out and use invite" onPress={() => void signOut()} fullWidth />
        <Button title="Stay signed in" variant="ghost" onPress={() => router.replace('/' as never)} fullWidth />
      </View>
    );
  }

  const canRetry = !problem || problem.kind !== 'expired';
  return (
    <View style={styles.root}>
      {problem || !t ? (
        <>
          <Text variant="section">Invite problem</Text>
          <Text muted style={{ textAlign: 'center' }}>
            {problem?.text ?? 'This invite link is not valid.'}
          </Text>
          {t && canRetry ? (
            <Button title={problem?.kind === 'wait' ? 'Try again later' : 'Try again'} onPress={retry} fullWidth />
          ) : null}
          <Button
            title={problem?.kind === 'expired' ? 'Sign in with a code' : 'Go to sign in'}
            variant={t && canRetry ? 'ghost' : 'default'}
            onPress={() => router.replace('/(auth)/login' as never)}
            fullWidth
          />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text muted>Opening your project...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    padding: space[6],
    backgroundColor: colors.background,
  },
});
