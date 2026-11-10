import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createUserBodySchema,
  listUsersQuerySchema,
  paginatedSchema,
  setUserPasswordBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Identity / Users'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/identity/users',
  tags: TAG,
  summary: 'List staff (Admin, HR)',
  description: 'Customers are left out unless `role=CUSTOMER` is given.',
  security,
  request: { query: listUsersQuerySchema },
  responses: {
    200: okResponse('A page of users', paginatedSchema(userSchema)),
    403: errorResponse('Not allowed'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/users',
  tags: TAG,
  summary: 'Create a staff account (Admin: any role; HR: sales, designer, technician, office)',
  description:
    'Omit `password` for someone who needs no app login (e.g. biometric-only floor staff).',
  security,
  request: { body: json(createUserBodySchema) },
  responses: {
    201: okResponse('Created', userSchema),
    400: errorResponse('Invalid details or unknown designation'),
    403: errorResponse('Role not allowed for your account'),
    409: errorResponse('Phone number already in use'),
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/identity/users/{id}',
  tags: TAG,
  summary: 'Get one user (Admin, HR)',
  security,
  request: { params: userIdParamsSchema },
  responses: { 200: okResponse('The user', userSchema), 404: errorResponse('Not found') },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/identity/users/{id}',
  tags: TAG,
  summary: 'Edit a user, or deactivate with `active: false` (Admin, HR)',
  security,
  request: { params: userIdParamsSchema, body: json(updateUserBodySchema) },
  responses: {
    200: okResponse('Updated', userSchema),
    403: errorResponse('Not allowed'),
    404: errorResponse('Not found'),
  },
});
openApiRegistry.registerPath({
  method: 'put',
  path: '/api/identity/users/{id}/password',
  tags: TAG,
  summary: 'Set or reset a password; also gives a no-login employee a login (Admin, HR)',
  security,
  request: { params: userIdParamsSchema, body: json(setUserPasswordBodySchema) },
  responses: { 200: okResponse('Set', z.object({})), 403: errorResponse('Not allowed') },
});

export interface UsersControllers {
  list: RequestHandler;
  get: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  setPassword: RequestHandler;
}

export function buildUsersRouter(c: UsersControllers): Router {
  const router = Router();
  // HR and Admin only. What each may do to WHICH account is decided in the use cases' policy.
  router.use(authenticate, requireRole('ADMIN', 'HR'));
  router.get('/', validate({ query: listUsersQuerySchema }), c.list);
  router.post('/', validate({ body: createUserBodySchema }), c.create);
  router.get('/:id', validate({ params: userIdParamsSchema }), c.get);
  router.patch(
    '/:id',
    validate({ params: userIdParamsSchema, body: updateUserBodySchema }),
    c.update,
  );
  router.put(
    '/:id/password',
    validate({ params: userIdParamsSchema, body: setUserPasswordBodySchema }),
    c.setPassword,
  );
  return router;
}
