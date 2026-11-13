import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loginBodySchema, otpRequestBodySchema, otpVerifyBodySchema } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Reveal } from '@/components/ui/reveal';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { loginPassword, requestOtp, verifyOtp } from '@/lib/api/endpoints/auth';
import { parseInviteToken } from '@/lib/auth/invite';
import { consumeSessionExpired, session } from '@/lib/auth/session';

const PHONE_KEY = 'auth.lastPhone';
const OTP_TTL_S = 300;
const MAX_TRIES = 5;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(() =>
    consumeSessionExpired() ? 'Session expired, sign in again.' : null,
  );
  const [cooldown, setCooldown] = useState(0);
  const [validFor, setValidFor] = useState(0);
  const [tries, setTries] = useState(0);
  const net = useNetInfo();
  const offline = net.isConnected === false;
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState('');

  useEffect(() => {
    SecureStore.getItemAsync(PHONE_KEY)
      .then((v) => v && setPhone((cur) => cur || v))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (validFor <= 0) return;
    const t = setTimeout(() => setValidFor((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [validFor]);

  const rememberPhone = () => {
    void SecureStore.setItemAsync(PHONE_KEY, phone).catch(() => undefined);
  };

  const locked = tries >= MAX_TRIES;
  const expired = step === 'code' && validFor <= 0;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const openInvite = () => {
    const token = parseInviteToken(invite);
    if (!token) return setError('Paste the full invite link you received.');
    setError(null);
    router.push({ pathname: '/invite/[token]', params: { token } } as never);
  };

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 429) setCooldown((c) => Math.max(c, 30));
    setNotice(null);
    setError(
      e instanceof NetworkError
        ? 'Connection lost. Check your internet and try again.'
        : e instanceof ApiError
          ? e.message
          : 'Something went wrong',
    );
  };

  const sendCode = async () => {
    const parsed = otpRequestBodySchema.safeParse({ phone });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter a valid phone number');
    if (cooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      await requestOtp(parsed.data);
      setStep('code');
      setCode('');
      setTries(0);
      setValidFor(OTP_TTL_S);
      setCooldown(30);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (locked || expired) return;
    const parsed = otpVerifyBodySchema.safeParse({ phone, code });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code');
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp(parsed.data);
      rememberPhone();
      await session.set(res);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_OTP') {
        const n = tries + 1;
        setTries(n);
        setCode('');
        setNotice(null);
        setError(
          n >= MAX_TRIES
            ? 'Too many wrong codes. Send a new code.'
            : 'That code is incorrect or has expired. Ask for a new one.',
        );
        return setBusy(false);
      }
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
      const res = await loginPassword(parsed.data);
      rememberPhone();
      await session.set(res);
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
                if (m === mode) return;
                setMode(m);
                setStep('phone');
                setCode('');
                setPassword('');
                setTries(0);
                setValidFor(0);
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
            <Button title="Sign in" onPress={signInWithPassword} loading={busy} disabled={offline} fullWidth size="lg" />
            <Text variant="caption" muted>
              Forgot your password? Ask your admin or HR to reset it, or sign in with a WhatsApp code.
            </Text>
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
            <Button title="Send code" onPress={sendCode} loading={busy} disabled={cooldown > 0 || offline} fullWidth size="lg" />
            <Text variant="caption" muted>
              No code? Ask your admin.
            </Text>
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={FadeIn.duration(200)} style={{ gap: space[4] }}>
            <Text muted>Enter the 6-digit code sent on WhatsApp to +91 {phone}</Text>
            <Text variant="caption" muted>
              {expired ? 'This code has expired. Send a new one.' : `Code valid for ${mmss(validFor)}`}
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="------"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoFocus
                editable={!locked && !expired}
                style={[styles.input, { letterSpacing: 8, textAlign: 'center' }]}
              />
            </View>
            <Button title="Verify and sign in" onPress={verify} loading={busy} disabled={locked || expired || offline} fullWidth size="lg" />
            <Button
              title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              variant="outline"
              onPress={sendCode}
              disabled={cooldown > 0 || busy || offline}
              fullWidth
            />
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
        {offline ? (
          <Text variant="caption" color={colors.mutedForeground}>
            You are offline. Connect to the internet to sign in.
          </Text>
        ) : null}
        {notice && !error ? (
          <Text variant="caption" color={colors.mutedForeground}>
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Animated.View entering={FadeIn} style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Feather name="alert-circle" size={18} color={colors.destructive} />
            <Text color={colors.destructive} style={{ flex: 1 }}>
              {error}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <View style={{ gap: space[3] }}>
        {showInvite ? (
          <>
            <View style={styles.inputRow}>
              <TextInput
                value={invite}
                onChangeText={setInvite}
                placeholder="Paste your invite link"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={openInvite}
                style={styles.input}
              />
            </View>
            <Button title="Open invite" onPress={openInvite} fullWidth />
          </>
        ) : (
          <Button title="I have an invite link" variant="ghost" onPress={() => setShowInvite(true)} fullWidth />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: colors.destructiveSoft,
  },
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
