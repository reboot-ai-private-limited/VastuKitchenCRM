import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { colors, radius, space } from '@/constants/theme';

export type StackedActivityItem = {
  id: string;
  title: string;
  detail: string;
  actionable?: boolean;
};

type Accent = { fg: string; bg: string };

const CARD_HEIGHT = 68;
const CARD_GAP = 2;
const SPRING_CONFIG = { damping: 26, stiffness: 220, mass: 0.9 };

function StackedCardItem({
  item,
  index,
  total,
  progress,
  accent,
  icon,
  expanded,
  onPress,
}: {
  item: StackedActivityItem;
  index: number;
  total: number;
  progress: SharedValue<number>;
  accent: Accent;
  icon: keyof typeof Feather.glyphMap;
  expanded: boolean;
  onPress: () => void;
}) {
  const depth = Math.min(index, 3);
  const collapsedScale = 0.96 - depth * 0.03;
  const expandedY = index * (CARD_HEIGHT + CARD_GAP);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [-8, expandedY]);
    const scale = interpolate(progress.value, [0, 1], [collapsedScale, 1]);
    const opacity = interpolate(progress.value, [0, 0.35, 1], [0, 0.7, 1]);
    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      pointerEvents={expanded ? 'auto' : 'none'}
      style={[styles.cardWrap, { zIndex: total - index }, animatedStyle]}
    >
      <Pressable
        disabled={!expanded || !item.actionable}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: `${accent.bg}80` },
          pressed && item.actionable ? { opacity: 0.8 } : null,
        ]}
      >
        <Feather name={icon} size={16} color={accent.fg} />
        <View style={styles.content}>
          <Text variant="label" color={colors.foreground} numberOfLines={1}>
            {item.title}
          </Text>
          <Text variant="caption" muted numberOfLines={1}>
            {item.detail}
          </Text>
        </View>
        {item.actionable ? (
          <Feather name="chevron-right" size={16} color={accent.fg} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Controlled dropdown deck: stays collapsed at height 0 until `expanded` is true,
 * then springs all cards open in one fan-out motion directly beneath the trigger row.
 */
export function StackedActivityCards({
  items,
  expanded,
  accent,
  icon,
  onPressItem,
}: {
  items: StackedActivityItem[];
  expanded: boolean;
  accent: Accent;
  icon: keyof typeof Feather.glyphMap;
  onPressItem: (item: StackedActivityItem, index: number) => void;
}) {
  const progress = useDerivedValue<number>(
    () => withSpring(expanded ? 1 : 0, SPRING_CONFIG),
    [expanded],
  );

  const expandedHeight =
    items.length > 0
      ? items.length * CARD_HEIGHT + (items.length - 1) * CARD_GAP
      : 0;

  const deckStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, expandedHeight]),
    marginTop: interpolate(progress.value, [0, 1], [0, 2]),
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.85, 1]),
  }));

  if (items.length === 0) return null;

  return (
    <Animated.View
      pointerEvents={expanded ? 'auto' : 'none'}
      style={[styles.deck, deckStyle]}
    >
      {items.map((item, idx) => (
        <StackedCardItem
          key={item.id}
          item={item}
          index={idx}
          total={items.length}
          progress={progress}
          accent={accent}
          icon={icon}
          expanded={expanded}
          onPress={() => onPressItem(item, idx)}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  deck: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  cardWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  card: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  content: {
    flex: 1,
    gap: 2,
  },
});
