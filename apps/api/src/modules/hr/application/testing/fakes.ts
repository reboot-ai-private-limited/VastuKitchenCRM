import type { LocationDto } from '@vastu/contracts';
import { atLocalTime, todayIn } from '@/shared/time/businessDate.js';
import type {
  AttendanceRecord,
  GeneratedRow,
  NewAttendance,
  SalaryRow,
} from '../../domain/hr.entity.js';
import type {
  AttendanceRepositoryPort,
  HrSettingsPort,
  SalaryRepositoryPort,
  StaffDirectoryPort,
  StaffRecord,
} from '../../domain/ports.js';
import type { BusinessClock } from '../services/clock.js';
import {
  BoardUseCase,
  CheckInUseCase,
  CheckOutUseCase,
  DeleteDayUseCase,
  MyMonthUseCase,
  SetDayUseCase,
  SimulateAttendanceUseCase,
  UserMonthUseCase,
} from '../usecases/attendance.usecases.js';
import {
  EditSalaryRowUseCase,
  ExportSalaryCsvUseCase,
  FinalizeSalarySheetUseCase,
  GenerateSalarySheetUseCase,
  GetSalarySheetUseCase,
} from '../usecases/salary.usecases.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

export class FakeAttendance implements AttendanceRepositoryPort {
  rows: AttendanceRecord[] = [];
  private seq = 0;
  private at(userId: string, date: string) {
    return this.rows.find((r) => r.userId === userId && r.date === date);
  }
  async checkIn(i: NewAttendance) {
    const existing = this.at(i.userId, i.date);
    if (existing) return { record: structuredClone(existing), created: false };
    const record: AttendanceRecord = {
      ...i,
      id: `at${++this.seq}`,
      correctedById: null,
      correctedAt: null,
      note: null,
    };
    this.rows.push(record);
    return { record: structuredClone(record), created: true };
  }
  async checkOut(userId: string, date: string, outAt: Date, location: LocationDto | null) {
    const r = this.at(userId, date);
    if (!r) return null;
    r.outAt = outAt;
    r.outLocation = location;
    return structuredClone(r);
  }
  async find(userId: string, date: string) {
    const r = this.at(userId, date);
    return r ? structuredClone(r) : null;
  }
  async setDay(i: Parameters<AttendanceRepositoryPort['setDay']>[0]) {
    const existing = this.at(i.userId, i.date);
    if (existing) {
      Object.assign(existing, {
        inAt: i.inAt,
        outAt: i.outAt,
        note: i.note,
        correctedById: i.byId,
        correctedAt: i.at,
      });
      return structuredClone(existing);
    }
    const record: AttendanceRecord = {
      id: `at${++this.seq}`,
      userId: i.userId,
      date: i.date,
      inAt: i.inAt,
      outAt: i.outAt,
      method: i.method,
      inLocation: null,
      outLocation: null,
      correctedById: null,
      correctedAt: null,
      note: i.note,
    };
    this.rows.push(record);
    return structuredClone(record);
  }
  async deleteDay(userId: string, date: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.date === date));
    return this.rows.length < before;
  }
  async forDate(date: string) {
    return this.rows.filter((r) => r.date === date).map((r) => structuredClone(r));
  }
  async forUserMonth(userId: string, month: string) {
    return this.rows
      .filter((r) => r.userId === userId && r.date.startsWith(month))
      .map((r) => structuredClone(r));
  }
  async forMonth(month: string) {
    return this.rows.filter((r) => r.date.startsWith(month)).map((r) => structuredClone(r));
  }
  async insertMissing(records: NewAttendance[]) {
    let n = 0;
    for (const r of records) {
      if (this.at(r.userId, r.date)) continue;
      await this.checkIn(r);
      const stored = this.at(r.userId, r.date)!;
      stored.outAt = r.outAt;
      stored.outLocation = r.outLocation;
      n++;
    }
    return n;
  }
}

export class FakeSalary implements SalaryRepositoryPort {
  rows: SalaryRow[] = [];
  async listMonth(month: string) {
    return this.rows.filter((r) => r.month === month).map((r) => structuredClone(r));
  }
  async find(month: string, userId: string) {
    const r = this.rows.find((x) => x.month === month && x.userId === userId);
    return r ? structuredClone(r) : null;
  }
  async upsertGenerated(rows: GeneratedRow[]) {
    for (const g of rows) {
      const existing = this.rows.find((r) => r.month === g.month && r.userId === g.userId);
      if (existing?.finalizedAt) continue;
      if (existing) {
        const { computedPayable, ...facts } = g;
        Object.assign(existing, facts, { computedPayable });
        if (!existing.editedAt) existing.payable = computedPayable;
      } else {
        this.rows.push({
          ...g,
          payable: g.computedPayable,
          editedById: null,
          editedAt: null,
          note: null,
          finalizedAt: null,
          finalizedById: null,
        });
      }
    }
  }
  async setPayable(
    month: string,
    userId: string,
    payable: number,
    note: string | null,
    byId: string,
    at: Date,
  ) {
    const r = this.rows.find((x) => x.month === month && x.userId === userId);
    if (!r || r.finalizedAt) return null;
    Object.assign(r, { payable, note, editedById: byId, editedAt: at });
    return structuredClone(r);
  }
  async finalize(month: string, byId: string, at: Date) {
    let n = 0;
    for (const r of this.rows)
      if (r.month === month && !r.finalizedAt) {
        r.finalizedAt = at;
        r.finalizedById = byId;
        n++;
      }
    return n;
  }
}

export class FakeStaff implements StaffDirectoryPort {
  rows: StaffRecord[] = [];
  async all() {
    return this.rows;
  }
}

export class FakeSettings implements HrSettingsPort {
  weeklyOffText = 'SUN';
  async weeklyOff() {
    return this.weeklyOffText;
  }
}

export const TZ = 'Asia/Kolkata';
export const ID = {
  admin: 'a0000000000000000000000a',
  hr: 'a0000000000000000000000b',
  gps: 'a0000000000000000000001a', // field sales, GPS
  gps2: 'a0000000000000000000001b',
  bio: 'a0000000000000000000002a', // office, biometric
  bio2: 'a0000000000000000000002b',
  gone: 'a0000000000000000000003a', // deactivated
  none: 'a0000000000000000000004a', // no attendance type (the owner)
};
export const staff = (
  over: Partial<StaffRecord> & Pick<StaffRecord, 'id' | 'name'>,
): StaffRecord => ({
  role: 'SALES',
  designation: 'Executive',
  attendanceType: 'GPS',
  fixedSalary: 25_000,
  active: true,
  ...over,
});

/** A clock you can move, running on the real business-timezone maths. */
export function makeClock(start: string) {
  const state = { now: new Date(start) };
  const clock: BusinessClock = {
    now: () => state.now,
    dateOf: (i) => todayIn(TZ, i),
    at: (date, hhmm) => atLocalTime(TZ, date, hhmm),
  };
  return { clock, set: (iso: string) => (state.now = new Date(iso)) };
}

/** Wednesday 11 November 2026, 10:00 in Siliguri. */
export function world(start = '2026-11-11T04:30:00Z') {
  const attendance = new FakeAttendance();
  const salary = new FakeSalary();
  const directory = new FakeStaff();
  const settings = new FakeSettings();
  const { clock, set } = makeClock(start);
  directory.rows = [
    staff({ id: ID.gps, name: 'Ravi', attendanceType: 'GPS', fixedSalary: 30_000 }),
    staff({ id: ID.gps2, name: 'Anil', attendanceType: 'GPS', fixedSalary: 20_000 }),
    staff({
      id: ID.bio,
      name: 'Rita',
      role: 'OFFICE',
      attendanceType: 'BIOMETRIC',
      fixedSalary: 25_000,
    }),
    staff({
      id: ID.bio2,
      name: 'Bimal',
      role: 'OFFICE',
      attendanceType: 'BIOMETRIC',
      fixedSalary: 12_000,
    }),
    staff({
      id: ID.gone,
      name: 'Gita',
      attendanceType: 'BIOMETRIC',
      fixedSalary: 18_000,
      active: false,
    }),
    staff({ id: ID.none, name: 'Owner', role: 'ADMIN', attendanceType: null, fixedSalary: 0 }),
  ];
  return {
    attendance,
    salary,
    directory,
    settings,
    clock,
    set,
    checkIn: new CheckInUseCase(directory, attendance, settings, clock),
    checkOut: new CheckOutUseCase(directory, attendance, settings, clock),
    myMonth: new MyMonthUseCase(directory, attendance, settings, clock),
    userMonth: new UserMonthUseCase(directory, attendance, settings, clock),
    board: new BoardUseCase(directory, attendance, settings, clock),
    setDay: new SetDayUseCase(directory, attendance, settings, clock),
    deleteDay: new DeleteDayUseCase(attendance),
    simulate: new SimulateAttendanceUseCase(directory, attendance, settings, clock),
    getSheet: new GetSalarySheetUseCase(salary),
    generate: new GenerateSalarySheetUseCase(directory, attendance, salary, settings, clock),
    editRow: new EditSalaryRowUseCase(salary, clock),
    finalize: new FinalizeSalarySheetUseCase(salary, clock),
    exportCsv: new ExportSalaryCsvUseCase(salary),
  };
}

export const as = (id: string, role = 'SALES') => ({ id, role });
