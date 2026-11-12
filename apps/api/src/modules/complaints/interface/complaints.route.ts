import { Router, type RequestHandler } from 'express';
import type { z } from 'zod';
import {
  addComplaintCommentBodySchema,
  assignComplaintBodySchema,
  complaintCommentParamsSchema,
  closeComplaintBodySchema,
  complaintCountsSchema,
  complaintIdParamsSchema,
  complaintPageSchema,
  complaintSchema,
  listComplaintsQuerySchema,
  raiseComplaintBodySchema,
  reopenComplaintBodySchema,
  resolveComplaintBodySchema,
  signComplaintUploadBodySchema,
  uploadTicketSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Complaints'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const params = { params: complaintIdParamsSchema };
const notFound = errorResponse('Not found (also returned when the complaint is not yours to see)');
const forbidden = errorResponse('You may never do this on a complaint');
const wrongStatus = errorResponse('Not possible in its current status, or someone just changed it');

const doc = (
  method: 'get' | 'post' | 'delete',
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

doc(
  'post',
  '/api/complaints/uploads/sign',
  'A signed ticket to upload a photo for a complaint about a project',
  { body: json(signComplaintUploadBodySchema) },
  { 200: okResponse('Upload ticket', uploadTicketSchema), 403: forbidden, 404: notFound },
  'Upload the photo as in the project feed, then send its `publicId` in `images` when you raise the complaint.',
);
doc(
  'post',
  '/api/complaints',
  'Raise a complaint about a project',
  { body: json(raiseComplaintBodySchema) },
  {
    201: okResponse('Raised (status OPEN)', complaintSchema),
    400: errorResponse('Bad photo'),
    403: forbidden,
    404: notFound,
  },
  "The customer raises it on their own project; Admin and Office on any project; Sales and Designers on a project they are on. Technicians and HR cannot. The Admins are alerted and the project's team timeline gets a line.",
);
doc(
  'get',
  '/api/complaints',
  'Complaints, newest first. Admin and Office see all; everyone else only theirs',
  { query: listComplaintsQuerySchema },
  { 200: okResponse('A page of complaints', complaintPageSchema) },
  '`assignedTo=me` gives a technician their job list.',
);
doc('get', '/api/complaints/counts', 'Complaints per status (scoped like the list)', undefined, {
  200: okResponse('Counts', complaintCountsSchema),
});
doc(
  'get',
  '/api/complaints/{complaintId}',
  'One complaint, with its history and what you can do',
  params,
  {
    200: okResponse('The complaint', complaintSchema),
    404: notFound,
  },
);
doc(
  'post',
  '/api/complaints/{complaintId}/assign',
  'Assign (or re-assign) to a staff member — Admin',
  { ...params, body: json(assignComplaintBodySchema) },
  {
    200: okResponse('Now ASSIGNED', complaintSchema),
    400: errorResponse('Not an active staff member'),
    403: forbidden,
    409: wrongStatus,
  },
);
doc(
  'post',
  '/api/complaints/{complaintId}/uploads/sign',
  'A photo-upload ticket for the resolution photo',
  params,
  { 200: okResponse('Upload ticket', uploadTicketSchema), 403: forbidden, 409: wrongStatus },
);
doc(
  'post',
  '/api/complaints/{complaintId}/comments/uploads/sign',
  'A photo-upload ticket for a message photo, for anyone who can see the complaint',
  params,
  { 200: okResponse('Upload ticket', uploadTicketSchema), 404: notFound, 409: wrongStatus },
);
doc(
  'post',
  '/api/complaints/{complaintId}/resolve',
  'Resolve with a note and photos — the assignee or an Admin',
  { ...params, body: json(resolveComplaintBodySchema) },
  { 200: okResponse('Now RESOLVED', complaintSchema), 403: forbidden, 409: wrongStatus },
);
doc(
  'post',
  '/api/complaints/{complaintId}/reopen',
  'Still broken: send it back to the technician — the customer or an Admin',
  { ...params, body: json(reopenComplaintBodySchema) },
  { 200: okResponse('Back to ASSIGNED', complaintSchema), 403: forbidden, 409: wrongStatus },
);
doc(
  'post',
  '/api/complaints/{complaintId}/close',
  'Close a resolved complaint — Admin',
  { ...params, body: json(closeComplaintBodySchema) },
  { 200: okResponse('Now CLOSED', complaintSchema), 403: forbidden, 409: wrongStatus },
);

doc(
  'post',
  '/api/complaints/{complaintId}/comments',
  'Write in the complaint conversation (text and/or photos) — anyone who can see the complaint',
  { ...params, body: json(addComplaintCommentBodySchema) },
  { 200: okResponse('The complaint with the new message', complaintSchema), 409: wrongStatus },
);
doc(
  'delete',
  '/api/complaints/{complaintId}/comments/{commentId}',
  'Remove a message — its author or an Admin',
  { params: complaintCommentParamsSchema },
  { 200: okResponse('The complaint without it', complaintSchema), 403: forbidden },
);

export interface ComplaintControllers {
  signRaise: RequestHandler;
  signResolve: RequestHandler;
  signComment: RequestHandler;
  raise: RequestHandler;
  list: RequestHandler;
  counts: RequestHandler;
  get: RequestHandler;
  assign: RequestHandler;
  resolve: RequestHandler;
  reopen: RequestHandler;
  close: RequestHandler;
  addComment: RequestHandler;
  deleteComment: RequestHandler;
}

export function buildComplaintsRouter(c: ComplaintControllers): Router {
  const router = Router();
  router.use(authenticate);
  const p = validate({ params: complaintIdParamsSchema });

  // Fixed paths first, so `/counts` and `/uploads/sign` are never read as a complaint id.
  router.post('/uploads/sign', validate({ body: signComplaintUploadBodySchema }), c.signRaise);
  router.get('/counts', c.counts);
  router.post('/', validate({ body: raiseComplaintBodySchema }), c.raise);
  router.get('/', validate({ query: listComplaintsQuerySchema }), c.list);
  router.get('/:complaintId', p, c.get);
  router.post('/:complaintId/uploads/sign', p, c.signResolve);
  router.post('/:complaintId/comments/uploads/sign', p, c.signComment);
  router.post(
    '/:complaintId/assign',
    validate({ params: complaintIdParamsSchema, body: assignComplaintBodySchema }),
    c.assign,
  );
  router.post(
    '/:complaintId/resolve',
    validate({ params: complaintIdParamsSchema, body: resolveComplaintBodySchema }),
    c.resolve,
  );
  router.post(
    '/:complaintId/reopen',
    validate({ params: complaintIdParamsSchema, body: reopenComplaintBodySchema }),
    c.reopen,
  );
  router.post(
    '/:complaintId/close',
    validate({ params: complaintIdParamsSchema, body: closeComplaintBodySchema }),
    c.close,
  );
  router.post(
    '/:complaintId/comments',
    validate({ params: complaintIdParamsSchema, body: addComplaintCommentBodySchema }),
    c.addComment,
  );
  router.delete(
    '/:complaintId/comments/:commentId',
    validate({ params: complaintCommentParamsSchema }),
    c.deleteComment,
  );
  return router;
}
