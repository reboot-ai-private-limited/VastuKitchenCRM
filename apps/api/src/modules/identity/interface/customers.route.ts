import { Router, type RequestHandler } from 'express';
import {
  addCustomerPhoneBodySchema,
  createCustomerBodySchema,
  customerInviteSchema,
  removeCustomerPhoneParamsSchema,
  userIdParamsSchema,
  userSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Identity / Customers'];
const security = [{ bearerAuth: [] }];

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/customers',
  tags: TAG,
  summary: 'Create a customer account, or return the existing one for that phone (Admin, Sales)',
  security,
  request: { body: { content: { 'application/json': { schema: createCustomerBodySchema } } } },
  responses: {
    201: okResponse('Customer', userSchema),
    409: errorResponse('Phone belongs to a staff account'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/customers/{id}/invite',
  tags: TAG,
  summary: 'Create a one-time sign-in link for a customer (Admin, Sales)',
  description:
    'Valid for the configured number of days; replaces any earlier link. Send it with the wa.me button.',
  security,
  request: { params: userIdParamsSchema },
  responses: {
    201: okResponse('Invite', customerInviteSchema),
    404: errorResponse('Customer not found'),
  },
});

export interface CustomersControllers {
  create: RequestHandler;
  invite: RequestHandler;
  getPhones: RequestHandler;
  addPhone: RequestHandler;
  removePhone: RequestHandler;
}

export function buildCustomersRouter(c: CustomersControllers): Router {
  const router = Router();
  router.use(authenticate);
  router.post(
    '/',
    requireRole('ADMIN', 'SALES'),
    validate({ body: createCustomerBodySchema }),
    c.create,
  );
  router.post(
    '/:id/invite',
    requireRole('ADMIN', 'SALES'),
    validate({ params: userIdParamsSchema }),
    c.invite,
  );
  router.get(
    '/:id/phones',
    requireRole('ADMIN', 'SALES', 'OFFICE'),
    validate({ params: userIdParamsSchema }),
    c.getPhones,
  );
  router.post(
    '/:id/phones',
    requireRole('ADMIN', 'SALES'),
    validate({ params: userIdParamsSchema, body: addCustomerPhoneBodySchema }),
    c.addPhone,
  );
  router.delete(
    '/:id/phones/:phone',
    requireRole('ADMIN', 'SALES'),
    validate({ params: removeCustomerPhoneParamsSchema }),
    c.removePhone,
  );
  return router;
}
