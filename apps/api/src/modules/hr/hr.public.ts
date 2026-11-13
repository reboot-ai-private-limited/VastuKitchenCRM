export interface HrDayCounts {
  date: string;
  /** The weekly off: nobody is expected. */
  offDay: boolean;
  /** Active staff on GPS or biometric tracking. */
  tracked: number;
  present: number;
  absent: number;
}

export interface HrUserAttendance {
  userId: string;
  /** Days with an in-time in the range. */
  daysPresent: number;
  /** The earliest in-time and the latest out-time in the range. */
  inAt: Date | null;
  outAt: Date | null;
}

export interface HrTarget {
  userId: string;
  amount: number;
  /** The earlier month it was carried from; null when set for the month asked. */
  carriedFrom: string | null;
}

/** The only thing another module may import from `hr/`. Read-only, for the dashboard. */
export interface HrPublicContract {
  /** Who is present and absent on this business day (`YYYY-MM-DD`). */
  dayCounts(date: string): Promise<HrDayCounts>;
  /** Attendance of everyone who has any in `from..to` (inclusive business dates). */
  attendanceSummary(from: string, to: string): Promise<HrUserAttendance[]>;
  /** Rupee sales targets for a month (`YYYY-MM`), carried forward from earlier months. */
  targetsForMonth(month: string): Promise<HrTarget[]>;
}
