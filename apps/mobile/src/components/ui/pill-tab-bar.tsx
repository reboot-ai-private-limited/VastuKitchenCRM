import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Text } from '@/components/ui/text';
import { colors, font, hit, radius, shadow, space } from '@/constants/theme';
import { softTick } from '@/lib/haptics';

const ICON_SIZE = 22;
const DURATION = 200;

type Descriptor = BottomTabBarProps['descriptors'][string];

type ItemProps = {
  options: Descriptor['options'];
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function TabItem({ options, label, focused, onPress, onLongPress }: ItemProps) {
  const [labelWidth, setLabelWidth] = useState(0);
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: DURATION });
  }, [focused, progress]);

  const badge = options.tabBarBadge;
  // Extra room so the badge never touches the label.
  const labelGap = badge === undefined ? space[2] : space[3];

  const labelStyle = useAnimatedStyle(
    () => ({
      width: progress.value * labelWidth,
      marginLeft: progress.value * labelGap,
      opacity: progress.value,
    }),
    [labelWidth, labelGap],
  );

  const color = focused ? colors.primary : colors.mutedForeground;

  return (
    // No click sound, ripple or press flash.
    <Pressable
      android_disableSound
      android_ripple={{ color: 'transparent' }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge === undefined ? label : `${label}, ${badge} unread`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.item, focused && styles.itemFocused]}
    >
      <View>
        {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
        {badge !== undefined ? (
          <View style={styles.badge}>
            <Text
              color={colors.primaryForeground}
              maxFontSizeMultiplier={1}
              style={styles.badgeText}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Animated.View style={[styles.labelClip, labelStyle]}>
        {/* Fixed-width row so the text can be measured while the clip is collapsed. */}
        <View style={styles.labelMeasure}>
          <Text
            variant="caption"
            color={colors.primary}
            numberOfLines={1}
            maxFontSizeMultiplier={1.15}
            onLayout={(e) => setLabelWidth(Math.ceil(e.nativeEvent.layout.width))}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Floating pill tab bar: the focused tab expands to show its label, the rest are icon only.
 * A screen with `tabBarItemStyle: { display: 'none' }` stays routable but gets no button.
 */
export function PillTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
      <View style={styles.pill} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options;
          if (!options || StyleSheet.flatten(options.tabBarItemStyle)?.display === 'none') {
            return null;
          }
          const focused = index === state.index;

          return (
            <TabItem
              key={route.key}
              options={options}
              label={options.title ?? route.name}
              focused={focused}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  softTick();
                  navigateToTab(route.key);
                }
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: 'center',
    paddingTop: space[2],
    paddingHorizontal: space[3],
    backgroundColor: colors.background,
  },
  pill: {
    ...shadow.card,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[1],
    width: '100%',
    maxWidth: 360,
    padding: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: hit,
    height: hit,
    paddingHorizontal: space[3],
    borderRadius: radius.full,
  },
  itemFocused: { backgroundColor: colors.primarySoft },
  labelClip: { overflow: 'hidden', flexShrink: 1 },
  labelMeasure: { width: 120, alignItems: 'flex-start' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: space[1],
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive,
  },
  badgeText: { fontFamily: font.semibold, fontSize: 10, lineHeight: 14 },
});
