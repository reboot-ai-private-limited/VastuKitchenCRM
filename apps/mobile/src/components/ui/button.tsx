import { ActivityIndicator, StyleSheet } from 'react-native';
import { colors, control, radius } from '@/constants/theme';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: keyof typeof control;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export function Button({ title, onPress, variant = 'default', size = 'md', loading, disabled, fullWidth, accessibilityLabel, accessibilityHint }: Props) {
  const isSolid = variant === 'default' || variant === 'destructive';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.base,
        { height: control[size] },
        fullWidth && styles.full,
        variant === 'default' && { backgroundColor: colors.primary },
        variant === 'destructive' && { backgroundColor: colors.destructive },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background },
        (disabled || loading) && { opacity: 0.55 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSolid ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text variant="label" color={isSolid ? colors.primaryForeground : colors.primary}>
          {title}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { minWidth: 48, paddingHorizontal: 20, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
});
