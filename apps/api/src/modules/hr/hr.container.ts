import type { Router } from 'express';
import { env } from '@/config/env.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import { createBusinessClock } from '@/shared/time/businessClock.js';
import {
  BoardUseCase,
  CheckInUseCase,
  CheckOutUseCase,
  DeleteDayUseCase,
  MyMonthUseCase,
  SetDayUseCase,
  SimulateAttendanceUseCase,
  UserMonthUseCase,
} from './application/usecases/attendance.usecases.js';
import {
  EditSalaryRowUseCase,
  ExportSalaryCsvUseCase,
  FinalizeSalarySheetUseCase,
  GenerateSalarySheetUseCase,
  GetSalarySheetUseCase,
} from './application/usecases/salary.usecases.js';
import { IdentityStaffDirectory, SettingsGateway } from './infrastructure/gateways.adapter.js';
import {
  MongoAttendanceRepository,
  MongoSalaryRepository,
} from './infrastructure/mongoHr.adapters.js';
import * as c from './interface/hr.controller.js';
import { buildAttendanceRouter, buildSalaryRouter } from './interface/hr.route.js';
import type { HrPublicContract, HrUserAttendance } from './hr.public.js';

export interface HrContainer {
  contract: HrPublicContract;
  /** Mounted at `/api/attendance`. */
  buildAttendanceRouter: () => Router;
  /** Mounted at `/api/salary`. */
  buildSalaryRouter: () => Router;
}

export interface HrDeps {
  /** Other modules' public contracts: the only ways HR reaches them. */
  identity: IdentityPublicContract;
  settings: SettingsPublicContract;
}

export function buildHrContainer(deps: HrDeps): HrContainer {
  // 1. Adapters
  const attendance = new MongoAttendanceRepository();
  const salary = new MongoSalaryRepository();
  const staff = new IdentityStaffDirectory(deps.identity);
  const settings = new SettingsGateway(deps.settings);
  const clock = createBusinessClock(env.BUSINESS_TIMEZONE);

  const board = new BoardUseCase(staff, attendance, settings, clock);
  return {
    contract: {
      async dayCounts(date) {
        const b = await board.execute(date);
        return {
          date: b.date,
          offDay: b.offDay,
          tracked: b.items.length,
          present: b.counts.present,
          absent: b.counts.absent,
        };
      },
      async attendanceSummary(from, to) {
        const by = new Map<string, HrUserAttendance>();
        for (const r of await attendance.forRange(from, to)) {
          const row = by.get(r.userId) ?? {
            userId: r.userId,
            daysPresent: 0,
            inAt: null,
            outAt: null,
          };
          row.daysPresent++;
          if (!row.inAt || r.inAt < row.inAt) row.inAt = r.inAt;
          if (r.outAt && (!row.outAt || r.outAt > row.outAt)) row.outAt = r.outAt;
          by.set(r.userId, row);
        }
        return [...by.values()];
      },
    },
    buildAttendanceRouter: () =>
      buildAttendanceRouter({
        checkIn: c.makeCheckIn(new CheckInUseCase(staff, attendance, settings, clock)),
        checkOut: c.makeCheckOut(new CheckOutUseCase(staff, attendance, settings, clock)),
        myMonth: c.makeMyMonth(new MyMonthUseCase(staff, attendance, settings, clock)),
        board: c.makeBoard(board),
        userMonth: c.makeUserMonth(new UserMonthUseCase(staff, attendance, settings, clock)),
        setDay: c.makeSetDay(new SetDayUseCase(staff, attendance, settings, clock)),
        deleteDay: c.makeDeleteDay(new DeleteDayUseCase(attendance)),
        simulate: c.makeSimulate(new SimulateAttendanceUseCase(staff, attendance, settings, clock)),
      }),
    buildSalaryRouter: () =>
      buildSalaryRouter({
        get: c.makeGetSheet(new GetSalarySheetUseCase(salary)),
        generate: c.makeGenerate(
          new GenerateSalarySheetUseCase(staff, attendance, salary, settings, clock),
        ),
        edit: c.makeEditRow(new EditSalaryRowUseCase(salary, clock)),
        finalize: c.makeFinalize(new FinalizeSalarySheetUseCase(salary, clock)),
        exportCsv: c.makeExportCsv(new ExportSalaryCsvUseCase(salary)),
      }),
  };
}
