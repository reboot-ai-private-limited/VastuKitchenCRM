import type { Request, RequestHandler } from 'express';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type {
  BoardUseCase,
  CheckInUseCase,
  CheckOutUseCase,
  DeleteDayUseCase,
  MyMonthUseCase,
  RangeUseCase,
  SetDayUseCase,
  SimulateAttendanceUseCase,
  UserMonthUseCase,
  Viewer,
} from '../application/usecases/attendance.usecases.js';
import type {
  GetTargetsUseCase,
  SetTargetUseCase,
} from '../application/usecases/targets.usecases.js';
import type {
  EditSalaryRowUseCase,
  ExportSalaryCsvUseCase,
  FinalizeSalarySheetUseCase,
  GenerateSalarySheetUseCase,
  GetSalarySheetUseCase,
} from '../application/usecases/salary.usecases.js';

function actorOf(req: Request): Viewer {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const p = (req: Request, name: string): string => String(req.params[name]);
const q = (req: Request, name: string): string | undefined => {
  const v = req.query[name];
  return typeof v === 'string' ? v : undefined;
};

export const makeCheckIn = (uc: CheckInUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req), req.body), 'Checked in.');
  });

export const makeCheckOut = (uc: CheckOutUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req), req.body), 'Checked out.');
  });

export const makeMyMonth = (uc: MyMonthUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req), q(req, 'month')), 'OK');
  });

export const makeUserMonth = (uc: UserMonthUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req), p(req, 'userId'), q(req, 'month')), 'OK');
  });

export const makeBoard = (uc: BoardUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(q(req, 'date')), 'OK');
  });

export const makeRange = (uc: RangeUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(String(q(req, 'from')), String(q(req, 'to'))), 'OK');
  });

export const makeSetDay = (uc: SetDayUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      await uc.execute(actorOf(req), p(req, 'userId'), p(req, 'date'), req.body),
      'Day saved.',
    );
  });

export const makeDeleteDay = (uc: DeleteDayUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(p(req, 'userId'), p(req, 'date'));
    sendSuccess(req, res, {}, 'Day removed.');
  });

export const makeSimulate = (uc: SimulateAttendanceUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const body = req.body as { days: number };
    sendSuccess(req, res, await uc.execute(body.days), 'Demo attendance generated.');
  });

export const makeGetSheet = (uc: GetSalarySheetUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(p(req, 'month')), 'OK');
  });

export const makeGenerate = (uc: GenerateSalarySheetUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(p(req, 'month')), 'Salary sheet generated.');
  });

export const makeEditRow = (uc: EditSalaryRowUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      await uc.execute(actorOf(req).id, p(req, 'month'), p(req, 'userId'), req.body),
      'Payable updated.',
    );
  });

export const makeFinalize = (uc: FinalizeSalarySheetUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req).id, p(req, 'month')), 'Month finalized.');
  });

export const makeExportCsv = (uc: ExportSalaryCsvUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const month = p(req, 'month');
    const csv = await uc.execute(month);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="salary-${month}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(csv);
  });

export const makeGetTargets = (uc: GetTargetsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(p(req, 'month')));
  });

export const makeSetTarget = (uc: SetTargetUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      await uc.execute(actorOf(req).id, p(req, 'month'), p(req, 'userId'), req.body),
      'Target saved.',
    );
  });
