import type { SalarySheetDto, UpdateSalaryBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { workingDatesOf } from '@/shared/time/weeklyOff.js';
import type { SalaryRow } from '../../domain/hr.entity.js';
import type {
  AttendanceRepositoryPort,
  HrSettingsPort,
  SalaryRepositoryPort,
  StaffDirectoryPort,
} from '../../domain/ports.js';
import { computePayable, loadCalendar } from '../services/attendanceCalendar.js';
import type { BusinessClock } from '../services/clock.js';

export function toSheet(month: string, rows: SalaryRow[]): SalarySheetDto {
  const first = rows[0];
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return {
    month,
    generated: rows.length > 0,
    weeklyOff: first?.weeklyOff ?? null,
    workingDays: first?.workingDays ?? null,
    finalizedAt:
      rows.length > 0 && rows.every((r) => r.finalizedAt)
        ? first!.finalizedAt!.toISOString()
        : null,
    rows: sorted.map((r) => ({
      userId: r.userId,
      name: r.name,
      designation: r.designation,
      fixedSalary: r.fixedSalary,
      presentDays: r.presentDays,
      workingDays: r.workingDays,
      computedPayable: r.computedPayable,
      payable: r.payable,
      edited: r.editedAt !== null,
      note: r.note,
    })),
    totals: {
      fixedSalary: rows.reduce((s, r) => s + r.fixedSalary, 0),
      payable: rows.reduce((s, r) => s + r.payable, 0),
    },
  };
}

export class GetSalarySheetUseCase {
  constructor(private readonly salary: SalaryRepositoryPort) {}

  async execute(month: string): Promise<SalarySheetDto> {
    return toSheet(month, await this.salary.listMonth(month));
  }
}

/**
 * Works the month out from attendance: fixed salary × days present ÷ working days. Safe to repeat:
 * it refreshes what nobody has touched, keeps hand-edited amounts, and refuses a finalized month.
 */
export class GenerateSalarySheetUseCase {
  constructor(
    private readonly staff: StaffDirectoryPort,
    private readonly attendance: AttendanceRepositoryPort,
    private readonly salary: SalaryRepositoryPort,
    private readonly settings: HrSettingsPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(month: string): Promise<SalarySheetDto> {
    if (month > this.clock.dateOf(this.clock.now()).slice(0, 7))
      throw AppError.badRequest('That month has not started yet.');
    const existing = await this.salary.listMonth(month);
    if (existing.some((r) => r.finalizedAt)) throw AppError.conflict('This month is finalized.');

    const calendar = await loadCalendar(this.settings);
    const workingDays = workingDatesOf(month, calendar.rules).length;
    const present = new Map<string, number>();
    for (const r of await this.attendance.forMonth(month))
      present.set(r.userId, (present.get(r.userId) ?? 0) + 1);

    // Everyone tracked who is active, plus anyone since deactivated who still worked that month.
    const people = (await this.staff.all()).filter(
      (s) => s.attendanceType !== null && (s.active || (present.get(s.id) ?? 0) > 0),
    );
    await this.salary.upsertGenerated(
      people.map((p) => {
        const presentDays = present.get(p.id) ?? 0;
        return {
          month,
          userId: p.id,
          name: p.name,
          designation: p.designation,
          fixedSalary: p.fixedSalary,
          presentDays,
          workingDays,
          computedPayable: computePayable(p.fixedSalary, presentDays, workingDays),
          weeklyOff: calendar.text,
        };
      }),
    );
    return toSheet(month, await this.salary.listMonth(month));
  }
}

export class EditSalaryRowUseCase {
  constructor(
    private readonly salary: SalaryRepositoryPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(
    actorId: string,
    month: string,
    userId: string,
    input: UpdateSalaryBodyDto,
  ): Promise<SalarySheetDto> {
    const row = await this.salary.find(month, userId);
    if (!row)
      throw AppError.notFound('No salary row for that person and month. Generate the month first.');
    const updated = await this.salary.setPayable(
      month,
      userId,
      input.payable,
      input.note ?? null,
      actorId,
      this.clock.now(),
    );
    if (!updated) throw AppError.conflict('This month is finalized.');
    return toSheet(month, await this.salary.listMonth(month));
  }
}

export class FinalizeSalarySheetUseCase {
  constructor(
    private readonly salary: SalaryRepositoryPort,
    private readonly clock: BusinessClock,
  ) {}

  async execute(actorId: string, month: string): Promise<SalarySheetDto> {
    const rows = await this.salary.listMonth(month);
    if (rows.length === 0) throw AppError.conflict('Generate the month first.');
    if (rows.every((r) => r.finalizedAt))
      throw AppError.conflict('This month is already finalized.');
    await this.salary.finalize(month, actorId, this.clock.now());
    return toSheet(month, await this.salary.listMonth(month));
  }
}

/** Spreadsheet programs run text that starts with = + - @ as a formula: defuse it. */
const cell = (v: string | number | null): string => {
  const text = v === null ? '' : String(v);
  const safe = typeof v === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export class ExportSalaryCsvUseCase {
  constructor(private readonly salary: SalaryRepositoryPort) {}

  async execute(month: string): Promise<string> {
    const sheet = toSheet(month, await this.salary.listMonth(month));
    if (!sheet.generated) throw AppError.notFound('Generate the month first.');
    const lines = [
      [
        'Name',
        'Designation',
        'Fixed salary',
        'Days present',
        'Working days',
        'Computed pay',
        'Payable',
        'Note',
      ],
      ...sheet.rows.map((r) => [
        r.name,
        r.designation,
        r.fixedSalary,
        r.presentDays,
        r.workingDays,
        r.computedPayable,
        r.payable,
        r.note,
      ]),
      [
        'Total',
        null,
        sheet.totals.fixedSalary,
        null,
        null,
        null,
        sheet.totals.payable,
        sheet.finalizedAt ? 'Finalized' : 'Not finalized',
      ],
    ];
    return lines.map((l) => l.map(cell).join(',')).join('\n') + '\n';
  }
}
