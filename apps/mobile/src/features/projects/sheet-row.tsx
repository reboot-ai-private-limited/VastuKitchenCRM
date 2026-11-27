import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space, tone, type Tone } from '@/constants/theme';

/** The chat's sheet row: a bordered card with a tinted icon tile, a label and an optional caption. */
export function SheetRow({
  icon,
  label,
  caption,
  t = 'accent',
  selected,
  disabled = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  caption?: string;
  t?: Tone;
  /** Set for rows that are a choice: shows the chosen state and a tick. */
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
      style={[styles.row, selected && styles.selected, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.icon, { backgroundColor: selected ? colors.card : tone[t].bg }]}>
        <Feather name={icon} size={17} color={tone[t].fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" color={t === 'danger' && !selected ? tone.danger.fg : colors.inkDeep}>
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" color={colors.inkMuted}>
            {caption}
          </Text>
        ) : null}
      </View>
      {selected ? <Feather name="check" size={18} color={colors.primary} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: hit,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
