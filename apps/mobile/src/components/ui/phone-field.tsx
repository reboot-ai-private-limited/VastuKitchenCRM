import { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  PHONE_COUNTRIES,
  joinPhone,
  splitPhone,
  type PhoneDialCode,
} from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ListRow } from '@/components/ui/list-row';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space } from '@/constants/theme';

export interface PhoneFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel?: string;
  autoFocus?: boolean;
}

/** Numeric mobile input with a leading country selector (India, Bhutan, Nepal). */
export function PhoneField({
  value,
  onChangeText,
  accessibilityLabel = 'Mobile number',
  autoFocus,
}: PhoneFieldProps) {
  const parsed = splitPhone(value);
  const [chosenDial, setDial] = useState<PhoneDialCode>(parsed.dial);
  const [picking, setPicking] = useState(false);

  // A filled value carries its own country; the choice only matters while the field is empty.
  const dial = value.trim() ? parsed.dial : chosenDial;
  const country = PHONE_COUNTRIES.find((c) => c.dial === dial) ?? PHONE_COUNTRIES[0];
  const local = value.trim() ? parsed.local : '';

  const selectDial = (nextDial: PhoneDialCode) => {
    const nextCountry = PHONE_COUNTRIES.find((c) => c.dial === nextDial) ?? PHONE_COUNTRIES[0];
    setDial(nextDial);
    onChangeText(joinPhone(nextDial, local.slice(0, nextCountry.digits)));
  };

  const handleLocalChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, country.digits);
    setDial(dial); // keep the country if the digits are cleared
    onChangeText(joinPhone(dial, digits));
  };

  return (
    <>
      <View style={styles.inputRow}>
        <PressableScale
          onPress={() => {
            Keyboard.dismiss();
            setPicking(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Country code, ${country.name} ${dial}. Change`}
          style={styles.country}
        >
          <Text variant="label" style={styles.dial}>
            {country.code} {dial}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </PressableScale>
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
      <BottomSheet visible={picking} onClose={() => setPicking(false)} title="Country">
        {PHONE_COUNTRIES.map((c) => (
          <ListRow
            key={c.code}
            title={`${c.name} ${c.dial}`}
            showChevron={false}
            trailing={c.dial === dial ? <Feather name="check" size={18} color={colors.primary} /> : null}
            onPress={() => {
              selectDial(c.dial);
              setPicking(false);
            }}
          />
        ))}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: hit,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  country: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    borderRightWidth: 1,
    borderRightColor: colors.input,
  },
  dial: { fontVariant: ['tabular-nums'] },
  input: {
    flex: 1,
    paddingHorizontal: space[3],
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
});
