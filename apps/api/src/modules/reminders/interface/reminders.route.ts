import { Router, type RequestHandler } from 'express';
import { reminderRunResultSchema } from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/reminders/run',
  tags: ['Reminders'],
  security: [{ bearerAuth: [] }],
  summary: 'Run the reminder rules now (Admin) — for demos and testing',
  description:
    'The same job that runs on a schedule. Safe to call repeatedly: an alert is never delivered twice. Thresholds come from env, in days (decimals allowed).',
  responses: {
    200: okResponse('How many new alerts each rule created', reminderRunResultSchema),
    403: errorResponse('Admin only'),
  },
});

export function buildRemindersRouter(run: RequestHandler): Router {
  const router = Router();
  router.post('/run', authenticate, requireRole('ADMIN'), run);
  return router;
}
