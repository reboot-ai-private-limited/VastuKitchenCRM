import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { ProposalsView } from '@/components/proposals/proposals-view';

export default function ProposalsPage() {
  return (
    <RoleGate roles={['ADMIN', 'SALES']}>
      <Suspense>
        <ProposalsView />
      </Suspense>
    </RoleGate>
  );
}
