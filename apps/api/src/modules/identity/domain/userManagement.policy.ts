import type { RoleName, StaffRole } from '@vastu/contracts';

/** Roles HR may create and edit. Admin and HR accounts are Admin-only, so HR cannot self-promote. */
const HR_MANAGEABLE: readonly RoleName[] = ['SALES', 'DESIGNER', 'TECHNICIAN', 'OFFICE'];

/** May `actor` give an account this role (create it, or change someone to it)? */
export function canAssignRole(actor: RoleName, role: StaffRole): boolean {
  if (actor === 'ADMIN') return true;
  if (actor === 'HR') return HR_MANAGEABLE.includes(role);
  return false;
}

/** May `actor` edit or reset the password of an existing account that has `targetRole`? */
export function canManageUser(actor: RoleName, targetRole: RoleName): boolean {
  if (actor === 'ADMIN') return true;
  if (actor === 'HR') return HR_MANAGEABLE.includes(targetRole);
  return false;
}
