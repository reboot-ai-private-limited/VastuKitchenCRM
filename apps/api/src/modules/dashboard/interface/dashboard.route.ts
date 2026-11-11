import { Router, type RequestHandler } from 'express';
import { dashboardQuerySchema, dashboardSchema } from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/dashboard',
  tags: ['Dashboard'],
  security: [{ bearerAuth: [] }],
  summary:
    'The owner’s dashboard: counters, staff activity, what needs attention, recent customer activity',
  description:
    'Read-only, worked out live from the other modules (nothing is stored). `from`/`to` are inclusive business dates, default today, at most 31 days; they set the period for "new leads", "won value" and each person\'s activity. "Staff present" is always today. **Admin** gets every block. **HR** gets only `staff` and each person\'s attendance (the other blocks are `null`). A block that fails to load is `null` and named in `errors`; the rest still renders. `attention` uses the same Admin-editable day thresholds as the reminders.',
  request: { query: dashboardQuerySchema },
  responses: {
    200: okResponse('The dashboard', dashboardSchema),
    400: errorResponse('"from" after "to", or more than 31 days'),
    403: errorResponse('Admin and HR only'),
  },
});

export function buildDashboardRouter(get: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN', 'HR'));
  router.get('/', validate({ query: dashboardQuerySchema }), get);
  return router;
}
