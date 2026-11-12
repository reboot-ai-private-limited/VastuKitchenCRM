import { Router } from 'express';
import { z } from 'zod';
import {
  duplicateProposalTemplateBodySchema,
  proposalTemplateKeyParamsSchema,
  proposalTemplateListSchema,
  proposalTemplateSchema,
  saveProposalTemplateBodySchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';
import type { TemplateControllers } from './templates.controller.js';

const TAG = ['Proposal templates'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const params = { params: proposalTemplateKeyParamsSchema };
const notFound = errorResponse('Template not found');
const locked = errorResponse('Admin only, or a built-in template (built-ins cannot be changed)');

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/proposal-templates',
  tags: TAG,
  security,
  summary: 'List templates: built-ins first, then custom (Admin, Sales)',
  responses: { 200: okResponse('Template summaries', proposalTemplateListSchema) },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/proposal-templates/{key}',
  tags: TAG,
  security,
  summary: 'One full template, ready to render (Admin, Sales)',
  request: params,
  responses: { 200: okResponse('The template', proposalTemplateSchema), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/proposal-templates',
  tags: TAG,
  security,
  summary: 'Create a custom template (Admin). The key is generated',
  request: { body: json(saveProposalTemplateBodySchema) },
  responses: {
    201: okResponse('Created', proposalTemplateSchema),
    400: errorResponse('Invalid template'),
    403: locked,
  },
});
openApiRegistry.registerPath({
  method: 'put',
  path: '/api/proposal-templates/{key}',
  tags: TAG,
  security,
  summary: 'Replace a custom template (Admin). Proposals already made keep their own copy',
  request: { ...params, body: json(saveProposalTemplateBodySchema) },
  responses: {
    200: okResponse('Saved', proposalTemplateSchema),
    403: locked,
    404: notFound,
  },
});
openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/proposal-templates/{key}',
  tags: TAG,
  security,
  summary: 'Delete a custom template (Admin). Safe: proposals keep their own copy',
  request: params,
  responses: { 200: okResponse('Deleted', z.object({})), 403: locked, 404: notFound },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/proposal-templates/{key}/duplicate',
  tags: TAG,
  security,
  summary: 'Copy any template into a new custom one (Admin). Default name "<name> copy"',
  request: { ...params, body: json(duplicateProposalTemplateBodySchema) },
  responses: { 201: okResponse('The copy', proposalTemplateSchema), 403: locked, 404: notFound },
});

export function buildTemplatesRouter(c: TemplateControllers): Router {
  const router = Router();
  router.use(authenticate);
  const key = validate({ params: proposalTemplateKeyParamsSchema });
  const staff = requireRole('ADMIN', 'SALES');
  const admin = requireRole('ADMIN');
  router.get('/', staff, c.list);
  router.get('/:key', staff, key, c.get);
  router.post('/', admin, validate({ body: saveProposalTemplateBodySchema }), c.create);
  router.put(
    '/:key',
    admin,
    validate({ params: proposalTemplateKeyParamsSchema, body: saveProposalTemplateBodySchema }),
    c.update,
  );
  router.delete('/:key', admin, key, c.remove);
  router.post(
    '/:key/duplicate',
    admin,
    validate({ params: proposalTemplateKeyParamsSchema, body: duplicateProposalTemplateBodySchema }),
    c.duplicate,
  );
  return router;
}
