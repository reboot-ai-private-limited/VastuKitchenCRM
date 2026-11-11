import type { AttendanceMethod, AttendanceType, LocationDto, RoleName } from '@vastu/contracts';
import type { AttendanceRecord, GeneratedRow, NewAttendance, SalaryRow } from './hr.entity.js';

export interface AttendanceRepositoryPort {
  /** Idempotent: when the day already has an in-time, returns it untouched. */
  checkIn(input: NewAttendance): Promise<{ record: AttendanceRecord; created: boolean }>;
  /** Sets the out-time (the last call wins); null when there is no in-time for the day yet. */
  checkOut(
    userId: string,
    date: string,
    outAt: Date,
    location: LocationDto | null,
  ): Promise<AttendanceRecord | null>;
  find(userId: string, date: string): Promise<AttendanceRecord | null>;
  /** Admin/HR sets a day: creates it, or changes it and marks it corrected. */
  setDay(input: {
    userId: string;
    date: string;
    inAt: Date;
    outAt: Date | null;
    /** Used only when the day does not exist yet. */
    method: AttendanceMethod;
    byId: string;
    note: string | null;
    at: Date;
  }): Promise<AttendanceRecord>;
  deleteDay(userId: string, date: string): Promise<boolean>;
  forDate(date: string): Promise<AttendanceRecord[]>;
  forUserMonth(userId: string, month: string): Promise<AttendanceRecord[]>;
  forMonth(month: string): Promise<AttendanceRecord[]>;
  /** Every record with `from <= date <= to` (`YYYY-MM-DD`). */
  forRange(from: string, to: string): Promise<AttendanceRecord[]>;
  /** Inserts only the days that do not exist yet; returns how many were created. */
  insertMissing(records: NewAttendance[]): Promise<number>;
}

export interface SalaryRepositoryPort {
  listMonth(month: string): Promise<SalaryRow[]>;
  find(month: string, userId: string): Promise<SalaryRow | null>;
  /**
   * Stores freshly computed rows. A finalized month is never touched; a row someone edited keeps
   * its `payable` (its facts still refresh); every other row is replaced.
   */
  upsertGenerated(rows: GeneratedRow[]): Promise<void>;
  /** Null when the row is missing or its month is finalized. */
  setPayable(
    month: string,
    userId: string,
    payable: number,
    note: string | null,
    byId: string,
    at: Date,
  ): Promise<SalaryRow | null>;
  /** Locks every row of the month, once; returns how many it locked (0 = nothing to lock). */
  finalize(month: string, byId: string, at: Date): Promise<number>;
}

export interface StaffRecord {
  id: string;
  name: string;
  role: RoleName;
  designation: string | null;
  attendanceType: AttendanceType | null;
  fixedSalary: number;
  active: boolean;
}

/** What HR needs from identity (the adapter wraps identity's public contract). */
export interface StaffDirectoryPort {
  all(): Promise<StaffRecord[]>;
}

export interface HrSettingsPort {
  /** The weekly-off rule text, e.g. `SUN; SAT:1,3` (Admin-editable). */
  weeklyOff(): Promise<string>;
}
