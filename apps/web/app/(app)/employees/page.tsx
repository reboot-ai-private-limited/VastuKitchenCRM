import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { EmployeesView } from '@/components/hr/employees-view';

export default function EmployeesPage() {
  return (
    <RoleGate roles={['ADMIN', 'HR']}>
      <Suspense>
        <EmployeesView />
      </Suspense>
    </RoleGate>
  );
}
