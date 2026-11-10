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

/** The small shape other modules get through the public contract. */
export interface UserSummary {
  id: string;
  name: string;
  role: RoleName;
  designation: string | null;
}

export interface UserListFilter {
  page: number;
  pageSize: number;
  search?: string | undefined;
  role?: RoleName | undefined;
  active?: boolean | undefined;
}
