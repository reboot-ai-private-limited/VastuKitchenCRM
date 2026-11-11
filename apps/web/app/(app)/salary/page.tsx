import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { SalaryView } from '@/components/hr/salary-view';

export default function SalaryPage() {
  return (
    <RoleGate roles={['ADMIN', 'HR']}>
      <Suspense>
        <SalaryView />
      </Suspense>
    </RoleGate>
  );
}
