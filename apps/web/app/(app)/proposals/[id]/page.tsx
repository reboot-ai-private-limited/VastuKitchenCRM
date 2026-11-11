'use client';

import { useParams } from 'next/navigation';
import { RoleGate } from '@/components/common/role-gate';
import { ProposalScreen } from '@/components/proposals/proposal-screen';

export default function ProposalPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RoleGate roles={['ADMIN', 'SALES']}>
      <ProposalScreen id={id} />
    </RoleGate>
  );
}
