import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { RoleName } from '@vastu/contracts';
import { Text } from '@/components/ui/text';
import { space } from '@/constants/theme';
import { useSession } from '@/lib/auth/session';

/** Renders children only for the listed roles; otherwise a plain "Not available" message. */
export function RoleGate({ roles, children }: { roles: readonly RoleName[]; children: ReactNode }) {
  const { user } = useSession();
  if (user && roles.includes(user.role)) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6] }}>
      <Text muted style={{ textAlign: 'center' }} accessibilityRole="alert">
        Not available for your role
      </Text>
    </View>
  );
}
