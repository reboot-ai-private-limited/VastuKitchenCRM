import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors, space } from '@/constants/theme';
import { Text } from './text';

export function EmptyState({ icon, message }: { icon: keyof typeof Feather.glyphMap; message: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
      <Feather name={icon} size={24} color={colors.mutedForeground} />
      <Text muted style={{ textAlign: 'center' }}>{message}</Text>
    </View>
  );
}
