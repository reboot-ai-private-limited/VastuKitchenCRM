import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  assignLeadBodySchema,
  callSchema,
  callStatSchema,
  callStatsQuerySchema,
  changeLeadStatusBodySchema,
  createLeadBodySchema,
  importLeadsBodySchema,
  importResultSchema,
  leadActivitySchema,
  leadIdParamsSchema,
  leadPageSchema,
  leadSchema,
  listLeadsQuerySchema,
  recordCallBodySchema,
  recordVisitBodySchema,
  updateLeadBodySchema,
  uploadTicketSchema,
  visitSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Leads'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const params = { params: leadIdParamsSchema };
const notFound = errorResponse('Not found (also returned for a lead outside your scope)');

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/leads',
  tags: TAG,
  security,
  summary: 'List leads (Admin, Office: all; Sales: only their own)',
  description:
    'Filters: `status`, `source`, `assignedTo` (`me`, `unassigned` or a user id), `stuck=true`, `search` (name, phone, city).',
  request: { query: listLeadsQuerySchema },
  responses: { 200: okResponse('A page of leads', leadPageSchema) },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads',
  tags: TAG,
  security,
  summary: 'Add a lead (Admin, Sales, Office). A Sales user owns what they add',
  request: { body: json(createLeadBodySchema) },
  responses: {
    201: okResponse('Created', leadSchema),
    409: errorResponse('Phone already exists; `data.existingLeadId` says which lead'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads/import',
  tags: TAG,
  security,
  summary: 'Bulk add from CSV rows parsed by the web app (Admin, Office), max 500',
  description:
    'Each row is validated on its own. Existing phones and repeats in the file are reported as duplicates, never overwritten. Imported leads are unassigned.',
  request: { body: json(importLeadsBodySchema) },
  responses: { 201: okResponse('Result per row', importResultSchema) },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/leads/call-stats',
  tags: TAG,
  security,
  summary: 'Calls, answered calls and talk time per employee (Admin). Defaults to today',
  request: { query: callStatsQuerySchema },
  responses: { 200: okResponse('Per-employee numbers', z.array(callStatSchema)) },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/leads/{id}',
  tags: TAG,
  security,
  summary: 'One lead',
  request: params,
  responses: { 200: okResponse('The lead', leadSchema), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/leads/{id}',
  tags: TAG,
  security,
  summary: 'Edit contact details (Admin, Sales). `null` clears an optional field',
  request: { ...params, body: json(updateLeadBodySchema) },
  responses: {
    200: okResponse('Updated', leadSchema),
    404: notFound,
    409: errorResponse('Phone already used by another lead'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads/{id}/assign',
  tags: TAG,
  security,
  summary: 'Assign to a sales person, or `userId: null` to unassign (Admin)',
  request: { ...params, body: json(assignLeadBodySchema) },
  responses: {
    200: okResponse('Assigned', leadSchema),
    400: errorResponse('Not a sales user'),
    404: notFound,
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads/{id}/status',
  tags: TAG,
  security,
  summary:
    'Move to any status (Admin, Sales). `LOST` needs `lostReason`; `WON` creates the customer',
  request: { ...params, body: json(changeLeadStatusBodySchema) },
  responses: {
    200: okResponse('Updated', leadSchema),
    400: errorResponse('Same status, or reason missing'),
    404: notFound,
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/leads/{id}/timeline',
  tags: TAG,
  security,
  summary: 'Activity timeline, newest first',
  request: params,
  responses: { 200: okResponse('Activities', z.array(leadActivitySchema)), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads/{id}/calls',
  tags: TAG,
  security,
  summary: "Record a call from the phone's call log (Admin, Sales). Safe to retry",
  description:
    'Idempotent on (lead, user, startedAt): a retry returns the stored call with 200. The first call on a NEW lead moves it to CONTACTED. The app must only upload calls to numbers of leads assigned to the user.',
  request: { ...params, body: json(recordCallBodySchema) },
  responses: {
    201: okResponse('Recorded', callSchema),
    200: okResponse('Already recorded', callSchema),
    404: notFound,
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/leads/{id}/calls',
  tags: TAG,
  security,
  summary: 'Call history (Admin, Sales)',
  request: params,
  responses: { 200: okResponse('Calls, newest first', z.array(callSchema)), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads/{id}/visits',
  tags: TAG,
  security,
  summary: 'Check in a visit with GPS (Admin, Sales). Allowed on any lead, including Won',
  request: { ...params, body: json(recordVisitBodySchema) },
  responses: { 201: okResponse('Recorded', visitSchema), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/leads/{id}/visits/photo-upload/sign',
  tags: TAG,
  security,
  summary: 'Upload ticket for a visit photo (Admin, Sales). Send the uploaded public id as `photoPublicId` when recording the visit',
  request: params,
  responses: { 200: okResponse('Ticket', uploadTicketSchema), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/leads/{id}/visits',
  tags: TAG,
  security,
  summary: 'Visit history (Admin, Sales)',
  request: params,
  responses: { 200: okResponse('Visits, newest first', z.array(visitSchema)), 404: notFound },
});

export interface LeadsControllers {
  list: RequestHandler;
  create: RequestHandler;
  importLeads: RequestHandler;
  callStats: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  assign: RequestHandler;
  changeStatus: RequestHandler;
  timeline: RequestHandler;
  recordCall: RequestHandler;
  listCalls: RequestHandler;
  recordVisit: RequestHandler;
  listVisits: RequestHandler;
  signVisitPhoto: RequestHandler;
}

export function buildLeadsRouter(c: LeadsControllers): Router {
  const router = Router();
  router.use(authenticate);

  // Fixed paths first, so `/import` and `/call-stats` are never read as an `:id`.
  router.get(
    '/',
    requireRole('ADMIN', 'SALES', 'OFFICE'),
    validate({ query: listLeadsQuerySchema }),
    c.list,
  );
  router.post(
    '/',
    requireRole('ADMIN', 'SALES', 'OFFICE'),
    validate({ body: createLeadBodySchema }),
    c.create,
  );
  router.post(
    '/import',
    requireRole('ADMIN', 'OFFICE'),
    validate({ body: importLeadsBodySchema }),
    c.importLeads,
  );
  router.get(
    '/call-stats',
    requireRole('ADMIN'),
    validate({ query: callStatsQuerySchema }),
    c.callStats,
  );

  const id = validate({ params: leadIdParamsSchema });
  router.get('/:id', requireRole('ADMIN', 'SALES', 'OFFICE'), id, c.get);
  router.get('/:id/timeline', requireRole('ADMIN', 'SALES', 'OFFICE'), id, c.timeline);
  router.patch(
    '/:id',
    requireRole('ADMIN', 'SALES'),
    validate({ params: leadIdParamsSchema, body: updateLeadBodySchema }),
    c.update,
  );
  router.post(
    '/:id/assign',
    requireRole('ADMIN'),
    validate({ params: leadIdParamsSchema, body: assignLeadBodySchema }),
    c.assign,
  );
  router.post(
    '/:id/status',
    requireRole('ADMIN', 'SALES'),
    validate({ params: leadIdParamsSchema, body: changeLeadStatusBodySchema }),
    c.changeStatus,
  );
  router.post(
    '/:id/calls',
    requireRole('ADMIN', 'SALES'),
    validate({ params: leadIdParamsSchema, body: recordCallBodySchema }),
    c.recordCall,
  );
  router.get('/:id/calls', requireRole('ADMIN', 'SALES'), id, c.listCalls);
  router.post(
    '/:id/visits',
    requireRole('ADMIN', 'SALES'),
    validate({ params: leadIdParamsSchema, body: recordVisitBodySchema }),
    c.recordVisit,
  );
  router.post('/:id/visits/photo-upload/sign', requireRole('ADMIN', 'SALES'), id, c.signVisitPhoto);
  router.get('/:id/visits', requireRole('ADMIN', 'SALES'), id, c.listVisits);
  return router;
}
