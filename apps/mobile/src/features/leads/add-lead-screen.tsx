import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createLeadBodySchema, LEAD_SOURCES, type LeadSource } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { useCreateLead } from './use-leads';

const SOURCE_LABEL: Record<LeadSource, string> = {
  WALK_IN: 'Walk-in',
  WEBSITE: 'Website',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  JUSTDIAL: 'Justdial',
  REFERRAL: 'Referral',
  EXISTING_CUSTOMER: 'Existing customer',
  OTHER: 'Other',
};

export function AddLeadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const create = useCreateLead();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<LeadSource>('WALK_IN');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = createLeadBodySchema.safeParse({
      name,
      phone,
      source,
      city: city.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter valid lead details');
      return;
    }
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: (lead) => {
        router.replace({ pathname: '/leads/[id]', params: { id: lead.id } } as Href);
      },
      onError: (err) => {
        setError(
          err instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : err instanceof ApiError
              ? err.message
              : 'Could not create lead',
        );
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={88}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: user?.role === 'OFFICE' ? 'Add walk-in lead' : 'New lead',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          padding: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[4],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ gap: space[3] }}>
          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Customer name *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Priya Verma"
              placeholderTextColor={colors.placeholder}
              autoFocus
              style={styles.input}
            />
          </View>

          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Mobile number (+91) *
            </Text>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>

          <View style={{ gap: space[2] }}>
            <Text variant="caption" muted>
              Source *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {LEAD_SOURCES.map((s) => {
                const active = s === source;
                return (
                  <PressableScale
                    key={s}
                    onPress={() => setSource(s)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
                      {SOURCE_LABEL[s]}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              City / Locality
            </Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Optional"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
            />
          </View>

          <View style={{ gap: space[1] }}>
            <Text variant="caption" muted>
              Notes
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Requirement, layout or budget notes"
              placeholderTextColor={colors.placeholder}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </View>
        </Card>

        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}

        <Button title="Save lead" size="lg" loading={create.isPending} onPress={submit} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  textarea: {
    height: 96,
    paddingTop: space[3],
    textAlignVertical: 'top',
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
});
