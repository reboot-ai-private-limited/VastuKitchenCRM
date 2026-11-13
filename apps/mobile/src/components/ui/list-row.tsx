import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, space, tone, type Tone } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  icon?: keyof typeof Feather.glyphMap;
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
  iconTone = 'neutral',
  leading,
  title,
  subtitle,
  trailing,
  showChevron = true,
  destructive = false,
  divider = false,
  onPress,
}: Props) {
  const fg = destructive ? colors.destructive : colors.foreground;
  const iconBg = destructive ? colors.destructiveSoft : tone[iconTone].bg;
  const iconFg = destructive ? colors.destructive : tone[iconTone].fg;

  const content = (
    <View style={[styles.row, divider && styles.divider]}>
      {leading ??
        (icon ? (
          <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
            <Feather name={icon} size={18} color={iconFg} />
          </View>
        ) : null)}
      <View style={styles.body}>
        <Text variant="label" color={fg} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" muted numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && showChevron && !destructive ? (
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
