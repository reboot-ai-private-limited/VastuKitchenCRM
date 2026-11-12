import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { redeemInvite } from '@/lib/api/endpoints/auth';
import { session } from '@/lib/auth/session';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const t = Array.isArray(token) ? token[0] : token;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // One-time token: redeem exactly once per attempt (guards double effects / re-renders).
    if (started.current) return;
    started.current = true;
    if (!t) return;
    redeemInvite(t)
      .then((res) => session.set(res))
      .catch((e: unknown) => {
        setError(
          e instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : e instanceof ApiError && e.status < 500
              ? 'This invite link has expired or was already used. Ask your coordinator for a new one.'
              : 'Could not open the invite. Please try again.',
        );
      });
  }, [t, attempt]);

  const retry = () => {
    started.current = false;
    setError(null);
    setAttempt((n) => n + 1);
  };

  return (
    <View style={styles.root}>
      {error || !t ? (
        <>
          <Text variant="section">Invite problem</Text>
          <Text muted style={{ textAlign: 'center' }}>
            {error ?? 'This invite link is not valid.'}
          </Text>
          <Button title="Try again" onPress={retry} fullWidth />
          <Button title="Go to sign in" variant="ghost" onPress={() => router.replace('/(auth)/login' as never)} fullWidth />
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
