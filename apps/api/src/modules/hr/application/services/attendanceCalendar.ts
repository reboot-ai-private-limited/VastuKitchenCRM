import type { AttendanceDayDto } from '@vastu/contracts';
import { parseWeeklyOff, isWeeklyOff, type OffRule } from '@/shared/time/weeklyOff.js';
import type { AttendanceRecord } from '../../domain/hr.entity.js';
import type { HrSettingsPort } from '../../domain/ports.js';

export interface Calendar {
  /** The rule text in force (stored on salary rows). */
  text: string;
  rules: OffRule[];
}

/** Reads the weekly-off rule; a bad stored value (it cannot be, but) falls back to Sundays. */
export async function loadCalendar(settings: HrSettingsPort): Promise<Calendar> {
  const text = await settings.weeklyOff();
  const parsed = parseWeeklyOff(text);
  return parsed.ok
    ? { text, rules: parsed.rules }
    : { text: 'SUN', rules: [{ weekday: 'SUN', weeks: [] }] };
}

/** One calendar day as the apps show it. `today` is the business "today". */
export function dayView(
  date: string,
  record: AttendanceRecord | undefined,
  calendar: Calendar,
  today: string,
): AttendanceDayDto {
  const offDay = isWeeklyOff(date, calendar.rules);
  const status = record ? 'PRESENT' : date > today ? 'FUTURE' : offDay ? 'OFF' : 'ABSENT';
  return {
    date,
    status,
    offDay,
    inAt: record?.inAt.toISOString() ?? null,
    outAt: record?.outAt?.toISOString() ?? null,
    method: record?.method ?? null,
    inLocation: record?.inLocation ?? null,
    outLocation: record?.outLocation ?? null,
    missingOut: !!record && record.outAt === null && date < today,
    corrected: !!record?.correctedAt,
    note: record?.note ?? null,
  };
}

/** Payable pay for the month: salary × days present (never more than the working days) ÷ working days. */
export function computePayable(
  fixedSalary: number,
  presentDays: number,
  workingDays: number,
): number {
  if (workingDays <= 0) return 0;
  return Math.round((fixedSalary * Math.min(presentDays, workingDays)) / workingDays);
}
