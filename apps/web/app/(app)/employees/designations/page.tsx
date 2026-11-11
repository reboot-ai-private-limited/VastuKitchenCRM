import { RoleGate } from '@/components/common/role-gate';
import { DesignationsView } from '@/components/hr/designations-view';

export default function DesignationsPage() {
  return (
    <RoleGate roles={['ADMIN', 'HR']}>
      <DesignationsView />
    </RoleGate>
  );
}
