import { Router, type RequestHandler } from 'express';
import type { z } from 'zod';
import {
  addCustomerBodySchema,
  customerIdParamsSchema,
  customerPageSchema,
  customerSchema,
  importCustomersBodySchema,
  importCustomersResultSchema,
  listCustomersQuerySchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Customers'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const params = { params: customerIdParamsSchema };

const doc = (
  method: 'get' | 'post',
  path: string,
  summary: string,
  request: Record<string, unknown> | undefined,
  responses: Record<string | number, unknown>,
  description?: string,
) =>
  openApiRegistry.registerPath({
    method,
    path,
    tags: TAG,
    security,
    summary,
    ...(description ? { description } : {}),
    ...(request ? { request } : {}),
    responses,
  } as never);

const notFound = errorResponse('Not found (also when the customer is not yours to see)');

doc(
  'get',
  '/api/customers',
  'Customers, those with a project first',
  { query: listCustomersQuerySchema },
  { 200: okResponse('A page of customers', customerPageSchema) },
  'A customer is a person with an account. Admin and Office see all; a Sales person sees the customers whose lead they own. Each customer carries their projects.',
);
doc(
  'get',
  '/api/customers/{customerId}',
  'One customer with their projects',
  params,
  { 200: okResponse('Customer', customerSchema), 404: notFound },
  "`leadId` is the lead behind them: its timeline (GET /api/leads/{id}/timeline) is the customer's timeline.",
);
doc(
  'post',
  '/api/customers',
  'Add someone who is already a customer',
  { body: json(addCustomerBodySchema) },
  {
    201: okResponse('Added', customerSchema),
    409: errorResponse('Already a customer, or the phone belongs to a staff account'),
  },
  'Creates their account and their lead (as Won, from "Existing customer", without making a project). A phone that is already a lead is linked, not duplicated.',
);
doc(
  'post',
  '/api/customers/import',
  'Add many customers from a spreadsheet',
  { body: json(importCustomersBodySchema) },
  { 200: okResponse('What was added and what was skipped', importCustomersResultSchema) },
);
doc(
  'post',
  '/api/customers/{customerId}/new-project',
  'Start a new project for an existing customer',
  params,
  { 200: okResponse('Their lead is back in the pipeline (NEW)', customerSchema), 404: notFound },
  'Puts their lead back to New on the same timeline. Its next win makes another project.',
);

export interface CustomersControllers {
  list: RequestHandler;
  get: RequestHandler;
  add: RequestHandler;
  importCustomers: RequestHandler;
  startNewProject: RequestHandler;
}

export function buildCustomersRouter(c: CustomersControllers): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN', 'SALES', 'OFFICE'));
  const p = validate({ params: customerIdParamsSchema });
  // Fixed paths first, so `/import` is never read as a customer id.
  router.post('/import', validate({ body: importCustomersBodySchema }), c.importCustomers);
  router.get('/', validate({ query: listCustomersQuerySchema }), c.list);
  router.post('/', validate({ body: addCustomerBodySchema }), c.add);
  router.get('/:customerId', p, c.get);
  router.post('/:customerId/new-project', p, c.startNewProject);
  return router;
}
