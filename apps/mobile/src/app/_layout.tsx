import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { getMe } from '@/lib/api/endpoints/auth';
import { session, useSession } from '@/lib/auth/session';
import { queryClient } from '@/lib/query/client';
import { useOutboxRunner } from '@/offline';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { status } = useSession();
  useOutboxRunner();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    void session.restore();
  }, []);

  useEffect(() => {
    if (status === 'signedOut') {
      queryClient.clear();
      return;
    }
    if (status === 'signedIn') {
      const ctrl = new AbortController();
      getMe(ctrl.signal)
        .then((me) => session.updateUser(me))
        .catch(() => undefined);
      return () => ctrl.abort();
    }
  }, [status]);

  const ready = status !== 'booting' && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Protected guard={status === 'signedOut'}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="invite/[token]" />
              </Stack.Protected>
              <Stack.Protected guard={status === 'signedIn'}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
            </Stack>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
