import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; scaleTo?: number };

/** Plain press feedback: a light fade while pressed. No scale, no bounce. */
export function PressableScale({ style, haptic: _haptic, scaleTo: _scaleTo, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [{ opacity: state.pressed ? 0.7 : 1 }, typeof style === 'function' ? undefined : style]}
      {...rest}
    />
  );
}
