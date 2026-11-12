import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { CustomersView } from '@/components/customers/customers-view';

/** Customers: people with an account and their projects. Admin, Sales and Office (matches the sidebar). */
export default function CustomersPage() {
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <Suspense>
        <CustomersView />
      </Suspense>
    </RoleGate>
  );
}
