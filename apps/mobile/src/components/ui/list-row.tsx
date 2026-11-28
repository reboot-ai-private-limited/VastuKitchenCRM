import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, hit, space, type Tone } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  icon?: keyof typeof Feather.glyphMap;
  /** Kept for caller compatibility; icons stay neutral unless destructive. */
  iconTone?: Tone;
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  divider?: boolean;
  onPress?: () => void;
};

export function ListRow({
  icon,
  leading,
  title,
  subtitle,
  trailing,
  showChevron = true,
  destructive = false,
  divider = false,
  onPress,
}: Props) {
  const fg = destructive ? colors.destructive : colors.inkDeep;
  const iconFg = destructive ? colors.destructive : colors.inkMuted;

  const content = (
    <View style={[styles.row, divider && styles.divider]}>
      {leading ??
        (icon ? (
          <View style={styles.iconSlot}>
            <Feather name={icon} size={19} color={iconFg} />
          </View>
        ) : null)}
      <View style={styles.body}>
        <Text variant="label" color={fg} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.inkMuted} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && showChevron && !destructive ? (
        <Feather name="chevron-right" size={16} color={colors.inkMuted} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale onPress={onPress} accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: hit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
