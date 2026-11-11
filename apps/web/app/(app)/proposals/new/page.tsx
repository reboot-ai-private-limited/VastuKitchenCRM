'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { NewProposalScreen } from '@/components/proposals/proposal-screen';

function Inner() {
  return <NewProposalScreen leadId={useSearchParams().get('leadId')} />;
}

export default function NewProposalPage() {
  return (
    <RoleGate roles={['ADMIN', 'SALES']}>
      <Suspense>
        <Inner />
      </Suspense>
    </RoleGate>
  );
}
