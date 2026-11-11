import { RoleGate } from '@/components/common/role-gate';
import { SettingsView } from '@/components/settings/settings-view';

export default function SettingsPage() {
  return (
    <RoleGate roles={['ADMIN']}>
      <SettingsView />
    </RoleGate>
  );
}
