import { z } from 'zod';
import { attendanceTypeSchema } from './identity.js';

/** `YYYY-MM-DD` and `YYYY-MM`, in the business timezone. */
export const dateStringSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Use YYYY-MM-DD');
export const monthStringSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

/** How a day's attendance was recorded. */
export const ATTENDANCE_METHODS = ['GPS', 'BIOMETRIC_SIM', 'MANUAL'] as const;
export const attendanceMethodSchema = z.enum(ATTENDANCE_METHODS);
export type AttendanceMethod = z.infer<typeof attendanceMethodSchema>;

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Metres. */
  accuracy: z.number().min(0).optional(),
});
export type LocationDto = z.infer<typeof locationSchema>;

/** PRESENT: has an in-time. ABSENT: working day with none. OFF: the weekly off. FUTURE: not yet. */
export const DAY_STATUSES = ['PRESENT', 'ABSENT', 'OFF', 'FUTURE'] as const;
export const dayStatusSchema = z.enum(DAY_STATUSES);
export type DayStatus = z.infer<typeof dayStatusSchema>;

export const attendanceDaySchema = z.object({
  date: z.string(),
  status: dayStatusSchema,
  offDay: z.boolean(),
  inAt: z.string().nullable(),
  outAt: z.string().nullable(),
  method: attendanceMethodSchema.nullable(),
  inLocation: locationSchema.nullable(),
  outLocation: locationSchema.nullable(),
  /** A past day with an in-time but no out-time. */
  missingOut: z.boolean(),
  /** Changed by Admin/HR after it was recorded. */
  corrected: z.boolean(),
  note: z.string().nullable(),
});
export type AttendanceDayDto = z.infer<typeof attendanceDaySchema>;

/**
 * Body of POST /attendance/check-in and /check-out. `capturedAt` is for a punch made offline and sent
 * later: the moment the person actually tapped. The server accepts it only when it is not in the future
 * (a few minutes of clock skew are allowed) and not older than 36 hours; otherwise 400. Without it
 * the server clock decides. Replaying the same punch is harmless (one record per person per day).
 */
export const checkInBodySchema = z.object({
  location: locationSchema.optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
});
export type CheckInBodyDto = z.infer<typeof checkInBodySchema>;

/** Admin/HR sets or corrects one person's day. Times are ISO instants on that date. */
export const setDayBodySchema = z.object({
  inAt: z.string().datetime({ offset: true }),
  outAt: z.string().datetime({ offset: true }).nullable().optional(),
  note: z.string().trim().min(1).max(200).optional(),
});
export type SetDayBodyDto = z.infer<typeof setDayBodySchema>;

export const attendanceUserDateParamsSchema = z.object({
  userId: z.string().min(1),
  date: dateStringSchema,
});
export const attendanceUserParamsSchema = z.object({ userId: z.string().min(1) });

export const monthQuerySchema = z.object({ month: monthStringSchema.optional() });
export const dateQuerySchema = z.object({ date: dateStringSchema.optional() });

export const attendanceMonthSchema = z.object({
  userId: z.string(),
  name: z.string(),
  month: z.string(),
  /** Days in the month that are not the weekly off. */
  workingDays: z.number().int(),
  /** Days with an in-time (including on a weekly off). */
  presentDays: z.number().int(),
  missingOutDays: z.number().int(),
  days: z.array(attendanceDaySchema),
});
export type AttendanceMonthDto = z.infer<typeof attendanceMonthSchema>;

export const boardItemSchema = z.object({
  userId: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  attendanceType: attendanceTypeSchema,
  day: attendanceDaySchema,
});
export const boardSchema = z.object({
  date: z.string(),
  offDay: z.boolean(),
  counts: z.object({ present: z.number().int(), absent: z.number().int(), missingOut: z.number().int() }),
  items: z.array(boardItemSchema),
});
export type BoardDto = z.infer<typeof boardSchema>;

export const simulateBodySchema = z.object({ days: z.number().int().min(1).max(60).default(14) });
export type SimulateBodyDto = z.infer<typeof simulateBodySchema>;
export const simulateResultSchema = z.object({ created: z.number().int(), skipped: z.number().int() });

/* ── salary ───────────────────────────────────────────────────────────────── */

export const salaryRowSchema = z.object({
  userId: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  fixedSalary: z.number(),
  presentDays: z.number().int(),
  workingDays: z.number().int(),
  /** fixedSalary × min(present, working) / working, to the rupee. */
  computedPayable: z.number().int(),
  /** What will be paid: the computed amount until an Admin/HR edits it. */
  payable: z.number().int(),
  edited: z.boolean(),
  note: z.string().nullable(),
});
export type SalaryRowDto = z.infer<typeof salaryRowSchema>;

export const salarySheetSchema = z.object({
  month: z.string(),
  /** False until someone generates it. */
  generated: z.boolean(),
  /** The weekly-off rule the working days were counted with. */
  weeklyOff: z.string().nullable(),
  workingDays: z.number().int().nullable(),
  finalizedAt: z.string().nullable(),
  rows: z.array(salaryRowSchema),
  totals: z.object({ fixedSalary: z.number().int(), payable: z.number().int() }),
});
export type SalarySheetDto = z.infer<typeof salarySheetSchema>;

export const salaryMonthParamsSchema = z.object({ month: monthStringSchema });
export const salaryRowParamsSchema = z.object({ month: monthStringSchema, userId: z.string().min(1) });

export const updateSalaryBodySchema = z.object({
  payable: z.number().int().min(0).max(100_000_000),
  note: z.string().trim().min(1).max(200).optional(),
});
export type UpdateSalaryBodyDto = z.infer<typeof updateSalaryBodySchema>;
