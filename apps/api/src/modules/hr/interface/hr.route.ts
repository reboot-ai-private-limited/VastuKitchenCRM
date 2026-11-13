import { Router, type RequestHandler } from 'express';
import type { z } from 'zod';
import { z as zod } from 'zod';
import {
  attendanceDaySchema,
  attendanceMonthSchema,
  attendanceUserDateParamsSchema,
  attendanceUserParamsSchema,
  boardSchema,
  checkInBodySchema,
  dateQuerySchema,
  monthQuerySchema,
  salaryMonthParamsSchema,
  salaryRowParamsSchema,
  salarySheetSchema,
  setDayBodySchema,
  setTargetBodySchema,
  targetsSheetSchema,
  simulateBodySchema,
  simulateResultSchema,
  updateSalaryBodySchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const hrOnly = errorResponse('Only Admin and HR');
const notFound = errorResponse('Not found');

const doc = (
  tag: 'HR / Attendance' | 'HR / Salary',
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  summary: string,
  request: Record<string, unknown> | undefined,
  responses: Record<string | number, unknown>,
  description?: string,
) =>
  openApiRegistry.registerPath({
    method,
    path,
    tags: [tag],
    security,
    summary,
    ...(description ? { description } : {}),
    ...(request ? { request } : {}),
    responses,
  } as never);

const A = 'HR / Attendance' as const;
const S = 'HR / Salary' as const;
const userDate = { params: attendanceUserDateParamsSchema };

doc(
  A,
  'post',
  '/api/attendance/check-in',
  'GPS check-in (staff tracked by GPS)',
  { body: json(checkInBodySchema) },
  {
    200: okResponse("Today's attendance", attendanceDaySchema),
    403: errorResponse('Not a GPS-tracked person'),
  },
  "The server's clock sets the time. Repeating it keeps the first check-in. Send the phone's location if you have it.",
);
doc(
  A,
  'post',
  '/api/attendance/check-out',
  'GPS check-out',
  { body: json(checkInBodySchema) },
  {
    200: okResponse("Today's attendance", attendanceDaySchema),
    409: errorResponse('Not checked in today'),
  },
  'The last check-out of the day wins.',
);
doc(
  A,
  'get',
  '/api/attendance/me',
  'My attendance for a month (default: this month)',
  { query: monthQuerySchema },
  {
    200: okResponse('Every day of the month', attendanceMonthSchema),
  },
  "Find today's entry in `days` to show the check-in / check-out button state.",
);
doc(
  A,
  'get',
  '/api/attendance/board',
  "Everyone's attendance for a day (Admin/HR)",
  { query: dateQuerySchema },
  {
    200: okResponse('Present / absent per person', boardSchema),
    403: hrOnly,
  },
);
doc(
  A,
  'get',
  '/api/attendance/users/{userId}',
  "One person's month. Admin/HR: anyone; others: only themselves",
  {
    params: attendanceUserParamsSchema,
    query: monthQuerySchema,
  },
  { 200: okResponse('Every day of the month', attendanceMonthSchema), 404: notFound },
);
doc(
  A,
  'put',
  '/api/attendance/users/{userId}/days/{date}',
  "Record or correct a person's day (Admin/HR)",
  {
    ...userDate,
    body: json(setDayBodySchema),
  },
  {
    200: okResponse('The day', attendanceDaySchema),
    400: errorResponse('Future day, times not on that day, or out before in'),
    403: hrOnly,
    404: notFound,
  },
  'This is how a (simulated) biometric punch is entered. Changing an existing day marks it corrected and keeps who changed it. `inAt` / `outAt` are ISO times; set `outAt` to null to clear it.',
);
doc(
  A,
  'delete',
  '/api/attendance/users/{userId}/days/{date}',
  'Remove a recorded day (Admin/HR)',
  userDate,
  {
    200: okResponse('Removed', zod.object({})),
    403: hrOnly,
    404: notFound,
  },
);
doc(
  A,
  'post',
  '/api/attendance/simulate',
  'DEMO: fill the last N days with believable attendance (Admin/HR)',
  {
    body: json(simulateBodySchema),
  },
  { 200: okResponse('How many days were created', simulateResultSchema), 403: hrOnly },
  'Never overwrites an existing day and skips the weekly off, so it is safe to run twice.',
);

const month = { params: salaryMonthParamsSchema };
doc(S, 'get', '/api/salary/{month}', 'The salary sheet for a month, `YYYY-MM` (Admin/HR)', month, {
  200: okResponse('The sheet (`generated: false` until generated)', salarySheetSchema),
  403: hrOnly,
});
doc(
  S,
  'post',
  '/api/salary/{month}/generate',
  'Work the month out from attendance (Admin/HR)',
  month,
  {
    200: okResponse('The sheet', salarySheetSchema),
    400: errorResponse('A month that has not started'),
    403: hrOnly,
    409: errorResponse('The month is finalized'),
  },
  'fixed salary × days present ÷ working days (present days never count beyond the working days). Working days = the month minus the weekly off (setting `hr.weeklyOff`). Safe to repeat: it refreshes untouched rows and keeps amounts that were edited by hand.',
);
doc(
  S,
  'patch',
  '/api/salary/{month}/users/{userId}',
  'Set what will be paid to one person (Admin/HR)',
  {
    params: salaryRowParamsSchema,
    body: json(updateSalaryBodySchema),
  },
  {
    200: okResponse('The sheet', salarySheetSchema),
    403: hrOnly,
    404: notFound,
    409: errorResponse('The month is finalized'),
  },
);
doc(
  S,
  'post',
  '/api/salary/{month}/finalize',
  'Lock the month (Admin/HR)',
  month,
  {
    200: okResponse('The finalized sheet', salarySheetSchema),
    403: hrOnly,
    409: errorResponse('Not generated, or already finalized'),
  },
  'After this, attendance changes no longer affect the month and the amounts cannot be edited.',
);
doc(S, 'get', '/api/salary/{month}/export.csv', 'Download the month as CSV (Admin/HR)', month, {
  200: { description: 'A CSV file', content: { 'text/csv': { schema: zod.string() } } },
  403: hrOnly,
  404: errorResponse('Not generated'),
});

export interface AttendanceControllers {
  checkIn: RequestHandler;
  checkOut: RequestHandler;
  myMonth: RequestHandler;
  board: RequestHandler;
  userMonth: RequestHandler;
  setDay: RequestHandler;
  deleteDay: RequestHandler;
  simulate: RequestHandler;
}

export function buildAttendanceRouter(c: AttendanceControllers): Router {
  const router = Router();
  router.use(authenticate);
  const hr = requireRole('ADMIN', 'HR');

  router.post('/check-in', validate({ body: checkInBodySchema }), c.checkIn);
  router.post('/check-out', validate({ body: checkInBodySchema }), c.checkOut);
  router.get('/me', validate({ query: monthQuerySchema }), c.myMonth);
  router.get('/board', hr, validate({ query: dateQuerySchema }), c.board);
  router.post('/simulate', hr, validate({ body: simulateBodySchema }), c.simulate);
  router.get(
    '/users/:userId',
    validate({ params: attendanceUserParamsSchema, query: monthQuerySchema }),
    c.userMonth,
  );
  router.put(
    '/users/:userId/days/:date',
    hr,
    validate({ params: attendanceUserDateParamsSchema, body: setDayBodySchema }),
    c.setDay,
  );
  router.delete(
    '/users/:userId/days/:date',
    hr,
    validate({ params: attendanceUserDateParamsSchema }),
    c.deleteDay,
  );
  return router;
}

export interface SalaryControllers {
  get: RequestHandler;
  generate: RequestHandler;
  edit: RequestHandler;
  finalize: RequestHandler;
  exportCsv: RequestHandler;
}

export function buildSalaryRouter(c: SalaryControllers): Router {
  const router = Router();
  // Salary is Admin/HR only, for every route of the module.
  router.use(authenticate, requireRole('ADMIN', 'HR'));
  const m = validate({ params: salaryMonthParamsSchema });

  router.get('/:month', m, c.get);
  router.post('/:month/generate', m, c.generate);
  router.post('/:month/finalize', m, c.finalize);
  router.get('/:month/export.csv', m, c.exportCsv);
  router.patch(
    '/:month/users/:userId',
    validate({ params: salaryRowParamsSchema, body: updateSalaryBodySchema }),
    c.edit,
  );
  return router;
}

export interface TargetControllers {
  get: RequestHandler;
  set: RequestHandler;
}

doc(
  S,
  'get',
  '/api/targets/{month}',
  'Every person’s sales target for a month (carried forward when not set)',
  { params: salaryMonthParamsSchema },
  { 200: okResponse('Targets', targetsSheetSchema), 403: hrOnly },
);
doc(
  S,
  'put',
  '/api/targets/{month}/users/{userId}',
  'Set one person’s rupee sales target for a month',
  { params: salaryRowParamsSchema, body: json(setTargetBodySchema) },
  { 200: okResponse('Targets', targetsSheetSchema), 403: hrOnly, 404: notFound },
);

export function buildTargetsRouter(c: TargetControllers): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN', 'HR'));
  router.get('/:month', validate({ params: salaryMonthParamsSchema }), c.get);
  router.put(
    '/:month/users/:userId',
    validate({ params: salaryRowParamsSchema, body: setTargetBodySchema }),
    c.set,
  );
  return router;
}
