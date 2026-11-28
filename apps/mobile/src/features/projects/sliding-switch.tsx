import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, space } from '@/constants/theme';
import { softTick } from '@/lib/haptics';

const PAD = 3;

export type SwitchOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
};

/** The chat's sliding pill: one thumb glides between equal-width options. */
export function SlidingSwitch<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  style,
}: {
  options: readonly SwitchOption<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const count = options.length;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segW = useSharedValue(0);
  const progress = useSharedValue(index);

  useEffect(() => {
    progress.value = withSpring(index, { damping: 22, stiffness: 260, mass: 0.85 });
  }, [index, progress]);

  const thumbStyle = useAnimatedStyle(() => {
    const w = segW.value;
    return {
      width: w,
      opacity: w > 0 ? 1 : 0,
      transform: [{ translateX: progress.value * w }],
    };
  });

  return (
    <View
      style={[styles.bar, style, disabled && { opacity: 0.6 }]}
      accessibilityRole="tablist"
      onLayout={(e) => {
        const innerW = e.nativeEvent.layout.width - 2 - PAD * 2;
        if (innerW > 0) segW.value = innerW / count;
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
      {options.map((o) => {
        const active = value === o.value;
        const color = active ? colors.primaryForeground : colors.inkMuted;
        return (
          <PressableScale
            key={o.value}
            disabled={disabled}
            onPress={() => {
              if (!active) {
                softTick();
                onChange(o.value);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            {o.icon ? <Feather name={o.icon} size={13} color={color} /> : null}
            <Text
              variant="caption"
              numberOfLines={1}
              color={color}
              style={{ fontFamily: active ? font.semibold : font.medium }}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    backgroundColor: colors.pageSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    padding: PAD,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 7,
    backgroundColor: colors.tealStrong,
  },
  segment: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: space[2],
  },
});
