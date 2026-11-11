'use client';

import type { ReactNode } from 'react';
import type { RoleName } from '@vastu/contracts';
import { useAuth } from '@/lib/auth';
import { NotFoundView } from './not-found-view';

/** Hides a whole page from roles that cannot use it. Cosmetic: the API is the real gate. */
export function RoleGate({ roles, children }: { roles: readonly RoleName[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <NotFoundView />;
  return <>{children}</>;
}
