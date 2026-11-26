import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  PHONE_COUNTRIES,
  joinPhone,
  splitPhone,
  type PhoneDialCode,
} from '@vastu/contracts';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';

export interface PhoneFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel?: string;
  autoFocus?: boolean;
}

/** Country-code chips (IN +91, BT +975, NP +977) + numeric input for mobile forms. */
export function PhoneField({
  value,
  onChangeText,
  accessibilityLabel = 'Mobile number',
  autoFocus,
}: PhoneFieldProps) {
  const parsed = splitPhone(value);
  const [dial, setDial] = useState<PhoneDialCode>(parsed.dial);

  useEffect(() => {
    if (value.trim()) setDial(splitPhone(value).dial);
  }, [value]);

  const country = PHONE_COUNTRIES.find((c) => c.dial === dial) ?? PHONE_COUNTRIES[0];
  const local = value.trim() ? parsed.local : '';

  const selectDial = (nextDial: PhoneDialCode) => {
    const nextCountry = PHONE_COUNTRIES.find((c) => c.dial === nextDial) ?? PHONE_COUNTRIES[0];
    setDial(nextDial);
    onChangeText(joinPhone(nextDial, local.slice(0, nextCountry.digits)));
  };

  const handleLocalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, country.digits);
    onChangeText(joinPhone(dial, digits));
  };

  return (
    <View style={{ gap: space[2] }}>
      <View style={styles.chipRow}>
        {PHONE_COUNTRIES.map((c) => {
          const active = c.dial === dial;
          return (
            <PressableScale
              key={c.code}
              onPress={() => selectDial(c.dial)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityLabel={`${c.name} ${c.dial}`}
            >
              <Text
                variant="caption"
                color={active ? colors.primaryForeground : colors.mutedForeground}
              >
                {c.code} {c.dial}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.inputRow}>
        <Text variant="label" muted style={styles.dialPrefix}>
          {dial}
        </Text>
        <TextInput
          value={local}
          onChangeText={handleLocalChange}
          accessibilityLabel={accessibilityLabel}
          placeholder={country.placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoFocus={autoFocus}
          maxLength={country.digits}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: space[2] },
  chip: {
    paddingHorizontal: space[3],
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    minHeight: 48,
  },
  dialPrefix: { fontVariant: ['tabular-nums'] },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
    paddingVertical: 10,
  },
});
