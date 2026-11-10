import type { RoleName } from '@vastu/contracts';

/**
 * Whether a list/get sees every record of a module or only those assigned to the caller. The ONE
 * place this is decided — use cases call it instead of branching on role names (ADR-0009).
 * Moving to permissions later means replacing this table, nothing deeper.
 */
export type Scope = 'all' | 'assigned';
export type ScopedModule = 'leads' | 'proposals' | 'projects' | 'complaints';

const SEES_ALL: Record<ScopedModule, readonly RoleName[]> = {
  leads: ['ADMIN', 'OFFICE'],
  proposals: ['ADMIN'],
  projects: ['ADMIN'],
  complaints: ['ADMIN', 'OFFICE'],
};

export function scopeFor(role: RoleName, module: ScopedModule): Scope {
  return SEES_ALL[module].includes(role) ? 'all' : 'assigned';
}
