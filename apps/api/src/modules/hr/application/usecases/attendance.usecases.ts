import type {
  AttendanceDayDto,
  AttendanceMonthDto,
  BoardDto,
  CheckInBodyDto,
  SetDayBodyDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { addDays } from '@/shared/time/businessDate.js';
import { datesOfMonth, isWeeklyOff, workingDatesOf } from '@/shared/time/weeklyOff.js';
import type { AttendanceRecord, NewAttendance } from '../../domain/hr.entity.js';
import type {
  AttendanceRepositoryPort,
  HrSettingsPort,
  StaffDirectoryPort,
  StaffRecord,
} from '../../domain/ports.js';
import { dayView, loadCalendar } from '../services/attendanceCalendar.js';
import type { BusinessClock } from '../services/clock.js';

export interface Viewer {
  id: string;
  role: 'ADMIN' | 'HR' | string;
}
const isHr = (v: Viewer) => v.role === 'ADMIN' || v.role === 'HR';

async function staffMember(
  staff: StaffDirectoryPort,
  id: string,
): Promise<StaffRecord | undefined> {
  return (await staff.all()).find((s) => s.id === id);
}

/** A person's month: every calendar day, what happened on it, and the totals. */
export async function buildMonth(
  member: StaffRecord,
  month: string,
  records: AttendanceRecord[],
  settings: HrSettingsPort,
  clock: BusinessClock,
): Promise<AttendanceMonthDto> {
  const calendar = await loadCalendar(settings);
  const today = clock.dateOf(clock.now());
  const byDate = new Map(records.map((r) => [r.date, r]));
  const days = datesOfMonth(month).map((d) => dayView(d, byDate.get(d), calendar, today));
  return {
    userId: member.id,
    name: member.name,
    month,
    workingDays: workingDatesOf(month, calendar.rules).length,
    presentDays: days.filter((d) => d.status === 'PRESENT').length,
    missingOutDays: days.filter((d) => d.missingOut).length,
    days,
  };
}

function resolveMonth(month: string | undefined, clock: BusinessClock): string {
  return month ?? clock.dateOf(clock.now()).slice(0, 7);
}

/** A queued punch may be this much ahead of the server clock (device clock skew) and this far back. */
export const CAPTURED_AT_SKEW_MS = 5 * 60_000;
export const CAPTURED_AT_MAX_AGE_MS = 36 * 3_600_000;

/**
 * The time a punch is recorded at. Live punches use the server clock. A punch queued offline may
 * carry `capturedAt`: accepted when not in the future and no older than 36 hours, else 400.
 */
export function punchTime(now: Date, capturedAt: string | undefined): Date {
  if (capturedAt === undefined) return now;
  const at = new Date(capturedAt);
  const age = now.getTime() - at.getTime();
  if (Number.isNaN(age) || age < -CAPTURED_AT_SKEW_MS)
    throw AppError.badRequest('That time has not happened yet.', [
      { path: ['capturedAt'], message: 'Must not be in the future' },
    ]);
  if (age > CAPTURED_AT_MAX_AGE_MS)
    throw AppError.badRequest('That punch is too old to record. Ask HR to correct the day.', [
      { path: ['capturedAt'], message: 'Must be within the last 36 hours' },
    ]);
  // A hair ahead of the server (allowed skew) is recorded as "now", never as a future time.
  return age < 0 ? now : at;
}

/**
 * GPS check-in from the app. The server's clock decides the time unless the app sends `capturedAt`
 * for a punch queued offline (bounded, see `punchTime`). One record per person per business day.
 */
export class CheckInUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(actor: Viewer, input: CheckInBodyDto): Promise<AttendanceDayDto> {
    const me = await mustBeGpsStaff(this.staff, actor.id);
    const now = this.clock.now();
    const at = punchTime(now, input.capturedAt);
    const date = this.clock.dateOf(at);
    const { record } = await this.attendance.checkIn({
      userId: me.id,
      date,
      inAt: at,
      outAt: null,
      method: 'GPS',
      inLocation: input.location ?? null,
      outLocation: null,
    });
    return dayView(date, record, await loadCalendar(this.settings), date);
  }
}

export class CheckOutUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(actor: Viewer, input: CheckInBodyDto): Promise<AttendanceDayDto> {
    const me = await mustBeGpsStaff(this.staff, actor.id);
    const now = this.clock.now();
    const at = punchTime(now, input.capturedAt);
    const date = this.clock.dateOf(at);
    const today = this.clock.dateOf(now);
    const existing = await this.attendance.find(me.id, date);
    if (!existing) throw AppError.conflict('Check in first.');
    if (input.capturedAt !== undefined && existing.outAt !== null) {
      // A replayed queued punch must not move an out-time that is already recorded.
      return dayView(date, existing, await loadCalendar(this.settings), today);
    }
    if (at < existing.inAt)
      throw AppError.badRequest('Check-out cannot be before check-in.', [
        { path: ['capturedAt'], message: 'Must be after the check-in time' },
      ]);
    const record = await this.attendance.checkOut(me.id, date, at, input.location ?? null);
    if (!record) throw AppError.conflict('Check in first.');
    return dayView(date, record, await loadCalendar(this.settings), today);
  }
}

async function mustBeGpsStaff(staff: StaffDirectoryPort, id: string): Promise<StaffRecord> {
  const me = await staffMember(staff, id);
  if (!me || !me.active) throw AppError.forbidden('Your account is not active.');
  if (me.attendanceType !== 'GPS')
    throw AppError.forbidden('Your attendance is recorded by the biometric device.');
  return me;
}

/** The caller's own month (the app's calendar) — and today's state for the check-in button. */
export class MyMonthUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(actor: Viewer, month?: string): Promise<AttendanceMonthDto> {
    const me = await staffMember(this.staff, actor.id);
    if (!me || me.attendanceType === null) throw AppError.notFound('No attendance for you.');
    const m = resolveMonth(month, this.clock);
    return buildMonth(
      me,
      m,
      await this.attendance.forUserMonth(me.id, m),
      this.settings,
      this.clock,
    );
  }
}

/** Admin/HR open anyone's month. Everyone else gets only their own (anyone else's is "not found"). */
export class UserMonthUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(viewer: Viewer, userId: string, month?: string): Promise<AttendanceMonthDto> {
    if (!isHr(viewer) && viewer.id !== userId) throw AppError.notFound('Employee not found.');
    const member = await staffMember(this.staff, userId);
    if (!member || member.attendanceType === null) throw AppError.notFound('Employee not found.');
    const m = resolveMonth(month, this.clock);
    return buildMonth(
      member,
      m,
      await this.attendance.forUserMonth(userId, m),
      this.settings,
      this.clock,
    );
  }
}

/** Everyone's day at a glance (Admin/HR). */
export class BoardUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(date?: string): Promise<BoardDto> {
    const today = this.clock.dateOf(this.clock.now());
    const day = date ?? today;
    const calendar = await loadCalendar(this.settings);
    const records = new Map((await this.attendance.forDate(day)).map((r) => [r.userId, r]));
    const people = (await this.staff.all()).filter((s) => s.active && s.attendanceType !== null);
    const items = people.map((p) => ({
      userId: p.id,
      name: p.name,
      designation: p.designation,
      attendanceType: p.attendanceType!,
      day: dayView(day, records.get(p.id), calendar, today),
    }));
    return {
      date: day,
      offDay: isWeeklyOff(day, calendar.rules),
      counts: {
        present: items.filter((i) => i.day.status === 'PRESENT').length,
        absent: items.filter((i) => i.day.status === 'ABSENT').length,
        missingOut: items.filter((i) => i.day.missingOut).length,
      },
      items,
    };
  }
}

/** Admin/HR record or correct one person's day (the simulated biometric punch, or a fix). */
export class SetDayUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(
    actor: Viewer,
    userId: string,
    date: string,
    input: SetDayBodyDto,
  ): Promise<AttendanceDayDto> {
    const member = await staffMember(this.staff, userId);
    if (!member || member.attendanceType === null) throw AppError.notFound('Employee not found.');
    const now = this.clock.now();
    const today = this.clock.dateOf(now);
    if (date > today) throw AppError.badRequest('You cannot record a day that has not happened.');

    const inAt = new Date(input.inAt);
    const outAt = input.outAt ? new Date(input.outAt) : null;
    const problems: Array<{ path: string[]; message: string }> = [];
    if (this.clock.dateOf(inAt) !== date)
      problems.push({ path: ['inAt'], message: `Must be on ${date}` });
    if (outAt && this.clock.dateOf(outAt) !== date)
      problems.push({ path: ['outAt'], message: `Must be on ${date}` });
    if (outAt && outAt < inAt)
      problems.push({ path: ['outAt'], message: 'Must be after the in-time' });
    if (problems.length > 0) throw AppError.badRequest('That day is not valid.', problems);

    const record = await this.attendance.setDay({
      userId,
      date,
      inAt,
      outAt,
      method: member.attendanceType === 'GPS' ? 'MANUAL' : 'BIOMETRIC_SIM',
      byId: actor.id,
      note: input.note ?? null,
      at: now,
    });
    return dayView(date, record, await loadCalendar(this.settings), today);
  }
}

export class DeleteDayUseCase {
  constructor(private readonly attendance: AttendanceRepositoryPort) {}

  async execute(userId: string, date: string): Promise<void> {
    if (!(await this.attendance.deleteDay(userId, date)))
      throw AppError.notFound('Nothing recorded for that day.');
  }
}

/** A small, stable hash: the same person and day always give the same "random" numbers. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SILIGURI = { lat: 26.7271, lng: 88.3953 };
const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * DEMO DATA. Fills the last N days (not today) with believable attendance for everyone tracked:
 * about 9 in 10 working days present, in around 9:00, out around 18:00, now and then no out-time.
 * Deterministic and additive — it never overwrites a day that already exists, so running it twice
 * changes nothing. Real punches (biometric device, GPS) replace it later.
 */
export class SimulateAttendanceUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(days: number): Promise<{ created: number; skipped: number }> {
    const calendar = await loadCalendar(this.settings);
    const today = this.clock.dateOf(this.clock.now());
    const people = (await this.staff.all()).filter((s) => s.active && s.attendanceType !== null);

    const records: NewAttendance[] = [];
    for (let back = 1; back <= days; back++) {
      const date = addDays(today, -back);
      if (isWeeklyOff(date, calendar.rules)) continue;
      for (const p of people) {
        const h = hash(`${p.id}:${date}`);
        if (h % 10 === 0) continue; // absent
        const inMin = 9 * 60 + ((h >>> 4) % 41) - 10; // 08:50 – 09:30
        const outMin = 18 * 60 + ((h >>> 12) % 61) - 15; // 17:45 – 18:45
        const gps = p.attendanceType === 'GPS';
        const where = (jitter: number) => ({
          lat: SILIGURI.lat + (((h >>> jitter) % 200) - 100) / 10_000,
          lng: SILIGURI.lng + (((h >>> (jitter + 3)) % 200) - 100) / 10_000,
          accuracy: 20,
        });
        records.push({
          userId: p.id,
          date,
          inAt: this.clock.at(date, hhmm(inMin)),
          outAt: h % 17 === 0 ? null : this.clock.at(date, hhmm(outMin)),
          method: gps ? 'GPS' : 'BIOMETRIC_SIM',
          inLocation: gps ? where(2) : null,
          outLocation: gps && h % 17 !== 0 ? where(5) : null,
        });
      }
    }
    const created = await this.attendance.insertMissing(records);
    return { created, skipped: records.length - created };
  }
}
