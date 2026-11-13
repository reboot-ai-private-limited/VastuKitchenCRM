import type { AttendanceMethod, LocationDto } from '@vastu/contracts';

export interface AttendanceRecord {
  id: string;
  userId: string;
  /** The business-timezone calendar day, `YYYY-MM-DD`. */
  date: string;
  inAt: Date;
  outAt: Date | null;
  method: AttendanceMethod;
  inLocation: LocationDto | null;
  outLocation: LocationDto | null;
  /** Set when Admin/HR changed the day after it was recorded. */
  correctedById: string | null;
  correctedAt: Date | null;
  note: string | null;
}

export type NewAttendance = Omit<AttendanceRecord, 'id' | 'correctedById' | 'correctedAt' | 'note'>;

export interface SalaryRow {
  month: string;
  userId: string;
  /** Name and designation as they were when the sheet was generated. */
  name: string;
  designation: string | null;
  fixedSalary: number;
  presentDays: number;
  workingDays: number;
  computedPayable: number;
  payable: number;
  /** Who changed `payable` by hand, and when. Null = it is still the computed amount. */
  editedById: string | null;
  editedAt: Date | null;
  note: string | null;
  /** The weekly-off rule the working days were counted with. */
  weeklyOff: string;
  finalizedAt: Date | null;
  finalizedById: string | null;
}

/** What generating computes for one person; the repository decides what it may overwrite. */
export type GeneratedRow = Pick<
  SalaryRow,
  | 'month'
  | 'userId'
  | 'name'
  | 'designation'
  | 'fixedSalary'
  | 'presentDays'
  | 'workingDays'
  | 'computedPayable'
  | 'weeklyOff'
>;

/** A rupee sales target for one person and one month (`YYYY-MM`). */
export interface SalesTarget {
  month: string;
  userId: string;
  amount: number;
  setById: string;
  setAt: Date;
}
