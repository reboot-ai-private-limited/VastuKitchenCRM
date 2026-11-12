import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loginBodySchema, otpRequestBodySchema, otpVerifyBodySchema } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { loginPassword, requestOtp, verifyOtp } from '@/lib/api/endpoints/auth';
import { session } from '@/lib/auth/session';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(
      e instanceof NetworkError
        ? 'Connection lost. Check your internet and try again.'
        : e instanceof ApiError
          ? e.message
          : 'Something went wrong',
    );

  const sendCode = async () => {
    const parsed = otpRequestBodySchema.safeParse({ phone });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
    setBusy(true);
    setError(null);
    try {
      await requestOtp(parsed.data);
      setStep('code');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const parsed = otpVerifyBodySchema.safeParse({ phone, code });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
    setBusy(true);
    setError(null);
    try {
      await session.set(await verifyOtp(parsed.data));
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const signInWithPassword = async () => {
    const parsed = loginBodySchema.safeParse({ phone, password });
    if (!parsed.success) {
      return setError(parsed.error.issues[0]?.message ?? 'Enter your phone number and password');
    }
    setBusy(true);
    setError(null);
    try {
      await session.set(await loginPassword(parsed.data));
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { paddingTop: insets.top + space[10] }]}
    >
      <Reveal>
        <Text variant="title">Vastu Kitchen</Text>
        <Text muted>Sign in to your workspace or kitchen project</Text>
      </Reveal>

      <View style={styles.segment}>
        {(['otp', 'password'] as const).map((m) => {
          const active = mode === m;
          return (
            <PressableScale
              key={m}
              onPress={() => {
                setMode(m);
                setError(null);
              }}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text variant="label" color={active ? colors.foreground : colors.mutedForeground}>
                {m === 'otp' ? 'Phone OTP' : 'Password'}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={{ gap: space[4] }}>
        {mode === 'password' ? (
          <Animated.View key="password" entering={FadeIn.duration(200)} style={{ gap: space[4] }}>
            <View style={styles.inputRow}>
              <Text variant="label" muted>
                +91
              </Text>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                style={styles.input}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void signInWithPassword()}
                style={styles.input}
              />
            </View>
            <Button title="Sign in" onPress={signInWithPassword} loading={busy} fullWidth size="lg" />
          </Animated.View>
        ) : step === 'phone' ? (
          <Animated.View key="phone" entering={FadeIn.duration(200)} style={{ gap: space[4] }}>
            <View style={styles.inputRow}>
              <Text variant="label" muted>
                +91
              </Text>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                textContentType="telephoneNumber"
                autoFocus
                style={styles.input}
              />
            </View>
            <Button title="Send code" onPress={sendCode} loading={busy} fullWidth size="lg" />
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={FadeIn.duration(200)} style={{ gap: space[4] }}>
            <Text muted>Enter the 6-digit code sent to +91 {phone}</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="------"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoFocus
                style={[styles.input, { letterSpacing: 8, textAlign: 'center' }]}
              />
            </View>
            <Button title="Verify and sign in" onPress={verify} loading={busy} fullWidth size="lg" />
            <Button
              title="Change number"
              variant="ghost"
              onPress={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
              fullWidth
            />
          </Animated.View>
        )}
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space[4], gap: space[6] },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.card,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    height: 52,
    paddingHorizontal: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, color: colors.foreground },
});
