'use client';

import type { RoleName } from '@vastu/contracts';
import { ComingSoon } from './coming-soon';
import { RoleGate } from './role-gate';

/** A route in the nav that is not built yet; still role-gated like the real page will be. */
export function PlaceholderPage({ title, roles }: { title: string; roles: readonly RoleName[] }) {
  return (
    <RoleGate roles={roles}>
      <ComingSoon title={title} />
    </RoleGate>
  );
}
