import { Router } from 'express';
import type { RequestHandler } from 'express';
import { healthReportSchema } from '@vastu/contracts';
import { okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/health',
  tags: ['Health'],
  summary: 'Report service health',
  responses: {
    200: okResponse('Service is healthy', healthReportSchema),
    503: { description: 'Service is degraded' },
  },
});

export function buildHealthRouter(getHealthController: RequestHandler): Router {
  const router = Router();
  router.get('/', getHealthController);
  return router;
}
