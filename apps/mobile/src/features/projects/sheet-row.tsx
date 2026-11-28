import type React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, space, type Tone } from '@/constants/theme';

/** Native-style action/choice row for bottom sheets and inline links. */
export function SheetRow({
  icon,
  label,
  caption,
  t = 'neutral',
  selected,
  disabled = false,
  divider = false,
  surface = false,
  showChevron = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  caption?: string;
  t?: Tone;
  /** Set for rows that are a choice: shows the chosen state and a tick. */
  selected?: boolean;
  disabled?: boolean;
  divider?: boolean;
  /** Render inside a bordered surface when placed inline on a screen instead of a sheet. */
  surface?: boolean;
  showChevron?: boolean;
  onPress: () => void;
}) {
  const destructive = t === 'danger' && !selected;
  const iconColor = selected
    ? colors.primary
    : destructive
      ? colors.destructive
      : colors.inkMuted;
  const labelColor = selected
    ? colors.primaryPressed
    : destructive
      ? colors.destructive
      : colors.inkDeep;

  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
      style={[
        styles.row,
        surface && styles.surface,
        divider && styles.divider,
        selected && styles.selected,
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={styles.iconSlot}>
        <Feather name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.body}>
        <Text
          variant="label"
          color={labelColor}
          style={selected ? { fontFamily: font.semibold } : undefined}
        >
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" color={colors.inkMuted}>
            {caption}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Feather name="check" size={18} color={colors.primary} />
      ) : showChevron ? (
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      ) : null}
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
  },
  surface: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderRadius: 0,
  },
  selected: {
    backgroundColor: colors.primarySoft,
  },
  iconSlot: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 1,
  },
});
