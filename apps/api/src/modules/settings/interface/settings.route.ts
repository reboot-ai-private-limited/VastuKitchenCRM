import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { settingKeyParamsSchema, settingSchema, updateSettingsBodySchema } from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Settings'];
const security = [{ bearerAuth: [] }];
const list = z.array(settingSchema);

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/settings',
  tags: TAG,
  security,
  summary: 'Every system setting with its current value and default (Admin)',
  description:
    'Grouped and labelled, so a Settings screen can render straight from this. `isDefault` says nothing has been changed for that setting.',
  responses: { 200: okResponse('All settings', list), 403: errorResponse('Admin only') },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/settings',
  tags: TAG,
  security,
  summary: 'Save one or more settings (Admin)',
  description:
    "Every value is checked against its setting's own rules first; if any is invalid, nothing is saved. Returns the full list.",
  request: { body: { content: { 'application/json': { schema: updateSettingsBodySchema } } } },
  responses: {
    200: okResponse('All settings, updated', list),
    400: errorResponse('A value is invalid, or the key is unknown (`data` names which)'),
  },
});
openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/settings/{key}',
  tags: TAG,
  security,
  summary: 'Reset one setting to its default (Admin)',
  request: { params: settingKeyParamsSchema },
  responses: { 200: okResponse('All settings', list), 404: errorResponse('Unknown setting') },
});

export interface SettingsControllers {
  list: RequestHandler;
  update: RequestHandler;
  reset: RequestHandler;
}

export function buildSettingsRouter(c: SettingsControllers): Router {
  const router = Router();
  // Only the Admin reads or changes settings. Other modules read them through the public contract.
  router.use(authenticate, requireRole('ADMIN'));
  router.get('/', c.list);
  router.patch('/', validate({ body: updateSettingsBodySchema }), c.update);
  router.delete('/:key', validate({ params: settingKeyParamsSchema }), c.reset);
  return router;
}
