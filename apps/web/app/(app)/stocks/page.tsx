import { Suspense } from 'react';
import { RoleGate } from '@/components/common/role-gate';
import { StocksView } from '@/components/stocks/stocks-view';

/** Stock is for Admin and Office. Cosmetic gate: the API refuses everyone else. */
export default function StocksPage() {
  return (
    <RoleGate roles={['ADMIN', 'OFFICE']}>
      <Suspense>
        <StocksView />
      </Suspense>
    </RoleGate>
  );
}
