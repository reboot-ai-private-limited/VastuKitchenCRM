import { useLocalSearchParams } from 'expo-router';
import { PersonAttendanceScreen } from '@/features/attendance/my-attendance-screen';

export default function UserAttendanceRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <PersonAttendanceScreen userId={userId} />;
}
