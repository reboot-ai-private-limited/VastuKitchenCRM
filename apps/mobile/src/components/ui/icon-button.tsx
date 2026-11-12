import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, hit, radius, tone } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
};

export function IconButton({ icon, label, badge, onPress }: Props) {
  const badgeText = badge && badge > 0 ? (badge > 9 ? '9+' : String(badge)) : null;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={badgeText ? `${label}, ${badgeText} unread` : label}
      style={styles.btn}
    >
      <Feather name={icon} size={20} color={colors.foreground} />
      {badgeText ? (
        <View style={styles.badge}>
          <Text
            variant="caption"
            color={colors.primaryForeground}
            maxFontSizeMultiplier={1.2}
            style={styles.badgeText}
          >
            {badgeText}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: hit,
    height: hit,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    backgroundColor: tone.danger.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
  },
});
