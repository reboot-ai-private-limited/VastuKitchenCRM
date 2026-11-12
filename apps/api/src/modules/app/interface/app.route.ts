import { Router } from 'express';
import type { RequestHandler } from 'express';
import { appConfigQuerySchema, appConfigSchema } from '@vastu/contracts';
import { validate } from '@/shared/http/validate.middleware.js';
import { okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/app/config',
  tags: ['App'],
  summary: 'Mobile app update policy, maintenance switch and tunables',
  description:
    'Public and cacheable (5 minutes). Per platform. The app calls it at launch; when it cannot be reached the app carries on.',
  request: { query: appConfigQuerySchema },
  responses: { 200: okResponse('The config', appConfigSchema) },
});

export function buildAppRouter(getConfig: RequestHandler): Router {
  const router = Router();
  router.get('/config', validate({ query: appConfigQuerySchema }), getConfig);
  return router;
}
