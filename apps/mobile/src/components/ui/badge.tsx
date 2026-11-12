import { View } from 'react-native';
import { radius, tone, type Tone } from '@/constants/theme';
import { Text } from './text';

export function Badge({ label, t = 'neutral' }: { label: string; t?: Tone }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: tone[t].bg,
        borderRadius: radius.full,
        paddingHorizontal: 10,
        paddingVertical: 2,
      }}
    >
      <Text variant="caption" color={tone[t].fg}>
        {label}
      </Text>
    </View>
  );
}
