import { Text as RNText, type TextProps } from 'react-native';
import { colors, type } from '@/constants/theme';

type Variant = keyof typeof type;
type Props = TextProps & { variant?: Variant; muted?: boolean; color?: string };

export function Text({ variant = 'body', muted, color, style, ...rest }: Props) {
  return (
    <RNText
      maxFontSizeMultiplier={1.5}
      style={[type[variant], { color: color ?? (muted ? colors.mutedForeground : colors.foreground) }, style]}
      {...rest}
    />
  );
}
