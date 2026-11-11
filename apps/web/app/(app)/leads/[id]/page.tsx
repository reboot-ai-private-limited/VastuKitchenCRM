'use client';

import { useParams } from 'next/navigation';
import { RoleGate } from '@/components/common/role-gate';
import { LeadDetail } from '@/components/leads/lead-detail';

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <LeadDetail id={id} />
    </RoleGate>
  );
}
