import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Pick<
  PressableProps,
  'onPress' | 'onLongPress' | 'accessibilityState' | 'accessibilityLabel' | 'testID'
> & { children?: ReactNode; style?: StyleProp<ViewStyle> };

/** Tab button with no click sound, no ripple and no press flash. */
export function QuietTabButton({ children, style, ...rest }: Props) {
  return (
    <Pressable
      android_disableSound
      android_ripple={{ color: 'transparent' }}
      accessibilityRole="tab"
      style={style}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
