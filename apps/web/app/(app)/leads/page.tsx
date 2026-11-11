import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { LeadsView } from '@/components/leads/leads-view';

export default function LeadsPage() {
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <Suspense>
        <LeadsView />
      </Suspense>
    </RoleGate>
  );
}
