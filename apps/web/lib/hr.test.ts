import type { AttendanceDayDto } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import {
  assignableRoles,
  calendarCells,
  canManageUser,
  clockToInstant,
  computePayable,
  correctionProblem,
  currentMonth,
  describeWeeklyOff,
  employeeFiltersToSearch,
  instantToClock,
  isDateString,
  isFutureMonth,
  isMonth,
  lastDayOf,
  monthLabel,
  monthOf,
  parseEmployeeFilters,
  parseRupees,
  presentOverWorking,
  shiftMonth,
  sumPayable,
  DEFAULT_EMPLOYEE_FILTERS,
} from './hr';

describe('months', () => {
  it('shifts across year ends', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', -11)).toBe('2025-12');
  });
  it('labels without a Date (no timezone drift)', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(monthLabel('2027-01')).toBe('January 2027');
  });
  it('validates month and date strings', () => {
    expect(isMonth('2026-13')).toBe(false);
    expect(isMonth('2026-02')).toBe(true);
    expect(isDateString('2026-02-31')).toBe(false);
    expect(isDateString('2026-02-28')).toBe(true);
  });
  it('knows the business month, not the browser one', () => {
    // 20:00 UTC on 30 Nov is already 1 Dec 01:30 in India.
    expect(currentMonth(new Date('2026-11-30T20:00:00Z'))).toBe('2026-12');
    expect(monthOf('2026-11-30')).toBe('2026-11');
  });
  it('refuses future months and finds a month end', () => {
    expect(isFutureMonth('2026-12', '2026-11-11')).toBe(true);
    expect(isFutureMonth('2026-11', '2026-11-11')).toBe(false);
    expect(lastDayOf('2026-02')).toBe('2026-02-28');
    expect(lastDayOf('2028-02')).toBe('2028-02-29');
  });
});

describe('clock times', () => {
  it('builds an IST instant and reads it back', () => {
    expect(clockToInstant('2026-11-10', '09:05')).toBe('2026-11-10T09:05:00+05:30');
    expect(instantToClock('2026-11-10T03:38:00.000Z')).toBe('09:08');
  });
  it('explains what is wrong with a correction', () => {
    expect(correctionProblem({ inAt: '', outAt: '', note: 'x' })).toMatch(/in time/);
    expect(correctionProblem({ inAt: '10:00', outAt: '09:00', note: 'x' })).toMatch(/before/);
    expect(correctionProblem({ inAt: '09:00', outAt: '', note: ' ' })).toMatch(/reason/);
    expect(
      correctionProblem({ inAt: '09:00', outAt: '18:00', note: 'Forgot to punch' }),
    ).toBeNull();
  });
});

describe('calendar', () => {
  const day = (date: string): AttendanceDayDto => ({
    date,
    status: 'PRESENT',
    offDay: false,
    inAt: null,
    outAt: null,
    method: null,
    inLocation: null,
    outLocation: null,
    missingOut: false,
    corrected: false,
    note: null,
  });
  it('starts the grid on Monday', () => {
    // 1 Nov 2026 is a Sunday: six empty cells before it.
    const cells = calendarCells([day('2026-11-01'), day('2026-11-02')]);
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells[6]?.date).toBe('2026-11-01');
    // 2 Nov 2026 is a Monday.
    expect(calendarCells([day('2026-11-02')])[0]?.date).toBe('2026-11-02');
  });
});

describe('employees', () => {
  it('limits what HR may assign', () => {
    expect(assignableRoles('ADMIN')).toContain('HR');
    expect(assignableRoles('HR')).not.toContain('ADMIN');
    expect(assignableRoles('HR')).not.toContain('HR');
    expect(assignableRoles('SALES')).toEqual([]);
    expect(canManageUser('HR', 'ADMIN')).toBe(false);
    expect(canManageUser('HR', 'SALES')).toBe(true);
  });
  it('round-trips filters and ignores junk', () => {
    const f = { search: 'ravi', role: 'SALES' as const, active: false, page: 2 };
    expect(parseEmployeeFilters(new URLSearchParams(employeeFiltersToSearch(f).slice(1)))).toEqual(
      f,
    );
    expect(parseEmployeeFilters(new URLSearchParams('role=CUSTOMER&active=x&page=0'))).toEqual(
      DEFAULT_EMPLOYEE_FILTERS,
    );
  });
  it('parses rupees', () => {
    expect(parseRupees('18,000')).toEqual({ ok: true, value: 18000 });
    expect(parseRupees('', { allowEmpty: true })).toEqual({ ok: true, value: 0 });
    expect(parseRupees('')).toMatchObject({ ok: false });
    expect(parseRupees('12.5')).toMatchObject({ ok: false });
  });
});

describe('salary', () => {
  it('matches the API formula and caps at full pay', () => {
    expect(computePayable(24000, 8, 25)).toBe(7680);
    expect(computePayable(18000, 21, 23)).toBe(16435);
    expect(computePayable(18000, 30, 23)).toBe(18000);
    expect(computePayable(18000, 5, 0)).toBe(0);
  });
  it('shows days and totals', () => {
    expect(presentOverWorking({ presentDays: 21, workingDays: 23 })).toBe('21 / 23');
    expect(sumPayable([{ payable: 100 }, { payable: 250 }])).toBe(350);
  });
  it('says the weekly off in words', () => {
    expect(describeWeeklyOff('SUN')).toBe('Sun');
    expect(describeWeeklyOff('SUN; SAT:1,3')).toBe('Sun + 1st/3rd Sat');
    expect(describeWeeklyOff('whatever')).toBe('whatever');
    expect(describeWeeklyOff(null)).toBe('');
  });
});

describe('attendanceHref', () => {
  it('builds the URLs the page reads', async () => {
    const { attendanceHref } = await import('./hr');
    expect(attendanceHref({})).toBe('/attendance');
    expect(attendanceHref({ date: '2026-11-10' })).toBe('/attendance?date=2026-11-10');
    expect(attendanceHref({ userId: 'u1', month: '2026-11' })).toBe(
      '/attendance?userId=u1&month=2026-11',
    );
  });
});
