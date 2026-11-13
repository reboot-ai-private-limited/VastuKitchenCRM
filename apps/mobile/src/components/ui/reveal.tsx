import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/** A short, plain fade-in. The index is kept so callers don't change, but items no longer stagger. */
export function Reveal({
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={style}>
      {children}
    </Animated.View>
  );
}
