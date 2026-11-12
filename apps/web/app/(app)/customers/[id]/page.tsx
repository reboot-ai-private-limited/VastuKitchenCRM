'use client';

import { useParams } from 'next/navigation';
import { RoleGate } from '@/components/common/role-gate';
import { CustomerDetail } from '@/components/customers/customer-detail';

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <CustomerDetail id={id} />
    </RoleGate>
  );
}
