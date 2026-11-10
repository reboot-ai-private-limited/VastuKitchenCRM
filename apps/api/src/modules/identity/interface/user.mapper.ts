import type { RoleName, UserDto } from '@vastu/contracts';
import type { User } from '../domain/user.entity.js';

/** Roles that may see salary figures (ADR-0009). Everyone else gets the user without `fixedSalary`. */
const SALARY_VISIBLE_TO: readonly RoleName[] = ['ADMIN', 'HR'];

export function toUserDto(user: User, viewerRole: RoleName): UserDto {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    designation: user.designation,
    attendanceType: user.attendanceType,
    ...(SALARY_VISIBLE_TO.includes(viewerRole) ? { fixedSalary: user.fixedSalary } : {}),
    active: user.active,
    canLogin: user.passwordHash !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
