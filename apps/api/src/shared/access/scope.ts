import type { RoleName } from '@vastu/contracts';

/**
 * Whether a list/get sees every record or only those assigned to the caller. The ONE place this
 * is decided — list and get use cases call it instead of branching on role names (ADR-0009).
 */
export type Scope = 'all' | 'assigned';

export function scopeFor(role: RoleName): Scope {
  return role === 'ADMIN' ? 'all' : 'assigned';
}
