import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import { AttendanceBoardView } from './attendance-board-view';

export function AttendanceBoardScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Attendance board',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <AttendanceBoardView standalone />
    </>
  );
}
