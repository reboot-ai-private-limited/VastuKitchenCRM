import { StyleSheet, View } from 'react-native';
import { colors, hit, radius } from '@/constants/theme';
import { initials } from '@/lib/format';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  name: string;
  size?: 32 | 36 | 40 | 52;
  accent?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Avatar({ name, size = 36, accent = false, onPress, accessibilityLabel }: Props) {
  const circle = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          backgroundColor: accent ? colors.primarySoft : colors.muted,
          borderColor: accent ? colors.primarySoft : colors.border,
        },
      ]}
    >
      <Text
        variant="caption"
        color={accent ? colors.primaryPressed : colors.mutedForeground}
        style={{ fontSize: size >= 48 ? 16 : 12 }}
      >
        {initials(name)}
      </Text>
    </View>
  );

  if (!onPress) return circle;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${name}, open profile`}
      hitSlop={Math.max(0, Math.ceil((hit - size) / 2))}
      style={styles.hit}
    >
      {circle}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: {
    minWidth: hit,
    minHeight: hit,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
