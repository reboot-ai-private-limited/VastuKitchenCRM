import type { Router } from 'express';
import { env } from '@/config/env.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import { atLocalTime, todayIn } from '@/shared/time/businessDate.js';
import type { BusinessClock } from './application/services/clock.js';
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
import type { HrPublicContract } from './hr.public.js';

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
  const clock: BusinessClock = {
    now: () => new Date(),
    dateOf: (instant) => todayIn(env.BUSINESS_TIMEZONE, instant),
    at: (date, hhmm) => atLocalTime(env.BUSINESS_TIMEZONE, date, hhmm),
  };

  return {
    contract: {},
    buildAttendanceRouter: () =>
      buildAttendanceRouter({
        checkIn: c.makeCheckIn(new CheckInUseCase(staff, attendance, settings, clock)),
        checkOut: c.makeCheckOut(new CheckOutUseCase(staff, attendance, settings, clock)),
        myMonth: c.makeMyMonth(new MyMonthUseCase(staff, attendance, settings, clock)),
        board: c.makeBoard(new BoardUseCase(staff, attendance, settings, clock)),
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
