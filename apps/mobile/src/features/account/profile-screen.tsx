import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { changePasswordBodySchema } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Reveal } from '@/components/ui/reveal';
import { Text } from '@/components/ui/text';
import { isStaffRole, ROLE_LABEL } from '@/constants/roles';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { changePassword } from '@/lib/api/endpoints/auth';
import { session, useSession } from '@/lib/auth/session';
import { useConfirmSignOut } from '@/lib/auth/sign-out';
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/lib/auth/support';
import { formatPhone } from '@/lib/format';
import { queryClient } from '@/lib/query/client';

export function ProfileScreen() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const confirmSignOut = useConfirmSignOut();
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPwError('The new passwords do not match.');
      return;
    }
    const parsed = changePasswordBodySchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? 'Check both password fields');
      return;
    }
    setPwBusy(true);
    setPwError(null);
    try {
      await changePassword(parsed.data);
      queryClient.clear();
      await session.clear();
      Alert.alert('Password updated', 'Your password was changed. Please sign in again.');
    } catch (e) {
      setPwError(
        e instanceof NetworkError
          ? 'Connection lost. Check your internet and try again.'
          : e instanceof ApiError
            ? e.message
            : 'Could not change password.',
      );
      setPwBusy(false);
    }
  };

  const handleDeleteAccountRequest = () => {
    Alert.alert(
      'Request account deletion',
      'Your account is not deleted from this app. Send a request to your Vastu Kitchen coordinator, who will review it. Records tied to active projects may be kept but anonymised.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: SUPPORT_WHATSAPP ? 'WhatsApp coordinator' : 'Email request',
          onPress: () => {
            const msg = 'Please delete my Vastu Kitchen account. Phone: ' + (user?.phone ?? '');
            const url = SUPPORT_WHATSAPP
              ? 'https://wa.me/' + SUPPORT_WHATSAPP + '?text=' + encodeURIComponent(msg)
              : 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('Account deletion request') + '&body=' + encodeURIComponent(msg);
            Linking.openURL(url).catch(() =>
              Alert.alert('Could not open', 'Please contact your coordinator directly.'),
            );
          },
        },
      ],
    );
  };

  if (!user) return null;
  const staff = isStaffRole(user.role);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Profile',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={{
            padding: space[4],
            paddingBottom: insets.bottom + space[8],
            gap: space[5],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Reveal>
            <Card style={styles.hero}>
              <Avatar name={user.name} size={52} accent />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="title" numberOfLines={1}>
                  {user.name}
                </Text>
                <Text muted style={{ fontVariant: ['tabular-nums'] }}>
                  {formatPhone(user.phone)}
                </Text>
                <View style={styles.badges}>
                  <Badge label={ROLE_LABEL[user.role]} t="accent" />
                  {user.designation ? <Badge label={user.designation} t="neutral" /> : null}
                  {user.attendanceType === 'GPS' ? <Badge label="GPS attendance" t="success" /> : null}
                </View>
              </View>
            </Card>
          </Reveal>

          {staff ? (
            <Reveal>
              <Card style={{ gap: space[3] }}>
                <ListRow
                  icon="lock"
                  iconTone="info"
                  title="Change password"
                  subtitle="Updates your password and signs out other devices"
                  onPress={() => {
                    setShowPwForm((v) => !v);
                    setPwError(null);
                  }}
                />
                {showPwForm ? (
                  <View style={{ gap: space[3], paddingTop: space[1] }}>
                    <TextInput
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Current password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                      autoCapitalize="none"
                      style={styles.input}
                    />
                    <TextInput
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="New password (min 8 characters)"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                      autoCapitalize="none"
                      style={styles.input}
                    />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.placeholder}
                      secureTextEntry
                      autoCapitalize="none"
                      style={styles.input}
                    />
                    {pwError ? (
                      <Text variant="caption" color={colors.destructive}>
                        {pwError}
                      </Text>
                    ) : null}
                    <Button
                      title="Update password"
                      loading={pwBusy}
                      onPress={() => void handlePasswordChange()}
                      fullWidth
                    />
                  </View>
                ) : null}
              </Card>
            </Reveal>
          ) : null}

          <Reveal style={{ gap: space[3] }}>
            <Button title="Sign out" variant="outline" onPress={() => confirmSignOut()} fullWidth />
            <Card style={{ paddingVertical: space[1] }}>
              <ListRow
                icon="trash-2"
                title="Request account deletion"
                subtitle="Ask your coordinator to remove your account"
                destructive
                onPress={handleDeleteAccountRequest}
              />
            </Card>
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[1],
  },
  input: {
    height: 48,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
});
