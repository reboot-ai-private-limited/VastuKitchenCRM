import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  STAFF_ROLES,
  createDesignationBodySchema,
  designationSchema,
  listDesignationsQuerySchema,
  updateDesignationBodySchema,
  userIdParamsSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Identity / Designations'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/identity/designations',
  tags: TAG,
  summary: 'List designations (any staff). Active only unless `includeInactive=true`',
  security,
  request: { query: listDesignationsQuerySchema },
  responses: { 200: okResponse('Designations', z.array(designationSchema)) },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/designations',
  tags: TAG,
  summary: 'Add a designation (Admin, HR)',
  security,
  request: { body: json(createDesignationBodySchema) },
  responses: {
    201: okResponse('Created', designationSchema),
    409: errorResponse('Already exists'),
  },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/identity/designations/{id}',
  tags: TAG,
  summary: 'Rename and/or (de)activate (Admin, HR). A rename also updates users who hold it',
  security,
  request: { params: userIdParamsSchema, body: json(updateDesignationBodySchema) },
  responses: {
    200: okResponse('Updated', designationSchema),
    404: errorResponse('Not found'),
    409: errorResponse('Name already exists'),
  },
});

export interface DesignationsControllers {
  list: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
}

export function buildDesignationsRouter(c: DesignationsControllers): Router {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/',
    requireRole(...STAFF_ROLES),
    validate({ query: listDesignationsQuerySchema }),
    c.list,
  );
  router.post(
    '/',
    requireRole('ADMIN', 'HR'),
    validate({ body: createDesignationBodySchema }),
    c.create,
  );
  router.patch(
    '/:id',
    requireRole('ADMIN', 'HR'),
    validate({ params: userIdParamsSchema, body: updateDesignationBodySchema }),
    c.update,
  );
  return router;
}
