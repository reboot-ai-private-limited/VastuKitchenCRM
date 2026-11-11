import type { AttendanceType, RoleName } from '@vastu/contracts';

export interface User {
  id: string;
  name: string;
  /** 10 digits, unique. The login identifier. */
  phone: string;
  role: RoleName;
  /** Text copied from the designations master list (not a reference). Null for customers. */
  designation: string | null;
  /** Null for customers. */
  attendanceType: AttendanceType | null;
  /** Rupees per month. */
  fixedSalary: number;
  /** Null means this person cannot log in (e.g. floor staff tracked by biometric only). */
  passwordHash: string | null;
  active: boolean;
  createdAt: Date;
}

export type NewUser = Omit<User, 'id' | 'createdAt'>;

/** A staff member as HR needs them: how they are tracked and what they are paid. */
export interface StaffMember {
  id: string;
  name: string;
  role: RoleName;
  designation: string | null;
  /** Null when never set (e.g. the owner's account). */
  attendanceType: AttendanceType | null;
  /** Rupees per month. */
  fixedSalary: number;
  active: boolean;
}

/** The small shape other modules get through the public contract. */
export interface UserSummary {
  id: string;
  name: string;
  /** 10 digits. */
  phone: string;
  role: RoleName;
  designation: string | null;
  /** False for a deactivated account (e.g. someone who must not be added to a project). */
  active: boolean;
}

export interface UserListFilter {
  page: number;
  pageSize: number;
  search?: string | undefined;
  role?: RoleName | undefined;
  active?: boolean | undefined;
}
