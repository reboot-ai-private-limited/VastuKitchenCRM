import { Stack } from 'expo-router';
import { AppHeader } from '@/components/ui/app-header';
import { useSession } from '@/lib/auth/session';

export default function AppLayout() {
  const { user } = useSession();
  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        header: (props) => <AppHeader {...props} />,
      }}
    >
      {/* Staff-only pushed screens live in this guard so a customer cannot open them by deep link. */}
      <Stack.Protected guard={!isCustomer}>
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="proposals/index" />
        <Stack.Screen name="proposals/[id]" />
        <Stack.Screen name="customers/[id]" />
        <Stack.Screen name="leads/new" />
        <Stack.Screen name="leads/[id]" />
        <Stack.Screen name="attendance/index" />
        <Stack.Screen name="attendance/board" />
        <Stack.Screen name="attendance/[userId]" />
        <Stack.Screen name="todos/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={isCustomer}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
    </Stack>
  );
}
