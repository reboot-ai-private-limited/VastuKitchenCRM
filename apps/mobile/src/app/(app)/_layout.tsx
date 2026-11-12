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
      <Stack.Protected guard={!isCustomer}>
        <Stack.Screen name="(staff)" />
      </Stack.Protected>
      <Stack.Protected guard={isCustomer}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
    </Stack>
  );
}
