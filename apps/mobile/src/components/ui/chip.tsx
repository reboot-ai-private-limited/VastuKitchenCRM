import { StyleSheet, View } from 'react-native';
import { colors, hit, radius } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = { label: string; active: boolean; onPress: () => void };

/** Filter chip: a 34dp pill inside a 48dp touch target, announced as a selectable button. */
export function Chip({ label, active, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={styles.hit}
    >
      <View style={[styles.pill, active && styles.pillActive]}>
        <Text variant="caption" color={active ? colors.primaryForeground : colors.mutedForeground}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hit: { minHeight: hit, minWidth: hit, justifyContent: 'center' },
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary },
});
