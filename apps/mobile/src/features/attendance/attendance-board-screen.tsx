import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { AttendanceBoardView } from './attendance-board-view';

export function AttendanceBoardScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: insets.top + space[4],
          paddingHorizontal: space[4],
          paddingBottom: space[2],
        }}
      >
        <Text variant="title" color={colors.inkDeep} style={{ textAlign: 'center' }}>
          Attendance board
        </Text>
      </View>
      <AttendanceBoardView standalone />
    </View>
  );
}
