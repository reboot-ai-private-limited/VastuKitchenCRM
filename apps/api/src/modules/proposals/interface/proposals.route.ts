import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  createProposalBodySchema,
  listProposalsQuerySchema,
  proposalIdParamsSchema,
  proposalPageSchema,
  proposalSchema,
  proposalTokenParamsSchema,
  publicProposalSchema,
  sendProposalResponseSchema,
  sendProposalWhatsappBodySchema,
  sendProposalWhatsappResponseSchema,
  updateProposalBodySchema,
} from '@vastu/contracts';
import { optionalAuthenticate } from '@/shared/http/optionalAuthenticate.middleware.js';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { buildErrorBody } from '@/shared/http/response.util.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Proposals'];
const PUBLIC_TAG = ['Proposals / Public'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const params = { params: proposalIdParamsSchema };
const notFound = errorResponse('Not found (also returned when the lead is outside your scope)');
const sentAlready = errorResponse('Already sent: sent proposals cannot be changed');

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/proposals',
  tags: TAG,
  security,
  summary: 'Create a draft proposal for a lead (Admin, Sales)',
  description:
    'The customer details are copied from the lead. Totals are computed on the server in whole rupees; the discount cannot exceed the subtotal.',
  request: { body: json(createProposalBodySchema) },
  responses: {
    201: okResponse('Draft created', proposalSchema),
    400: errorResponse('Invalid details'),
    404: notFound,
  },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/proposals',
  tags: TAG,
  security,
  summary: 'List proposals (Admin: all; Sales: those they made, or any for a lead they can access)',
  request: { query: listProposalsQuerySchema },
  responses: { 200: okResponse('A page of proposals', proposalPageSchema) },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/proposals/{id}',
  tags: TAG,
  security,
  summary:
    "One proposal — also the sales person's own preview (never counts as the customer seeing it)",
  request: params,
  responses: { 200: okResponse('The proposal', proposalSchema), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'patch',
  path: '/api/proposals/{id}',
  tags: TAG,
  security,
  summary: 'Edit a draft. `null` clears an optional field',
  request: { ...params, body: json(updateProposalBodySchema) },
  responses: { 200: okResponse('Updated', proposalSchema), 404: notFound, 409: sentAlready },
});
openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/proposals/{id}',
  tags: TAG,
  security,
  summary: 'Delete a proposal',
  description:
    'A draft can be deleted by whoever can edit it. A sent proposal can be deleted by an Admin only; the customer’s link then stops working (not found).',
  request: params,
  responses: {
    200: okResponse('Deleted', z.object({})),
    403: errorResponse('Only an Admin can delete a sent proposal'),
    404: notFound,
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/proposals/{id}/duplicate',
  tags: TAG,
  security,
  summary:
    'Copy a proposal into a new draft (new number and link) — how a sent proposal is changed',
  request: params,
  responses: { 201: okResponse('New draft', proposalSchema), 404: notFound },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/proposals/{id}/send',
  tags: TAG,
  security,
  summary: 'Mark as sent and get the public link + a prefilled WhatsApp link',
  description:
    'Moves the lead to Proposal Sent (unless Won/Lost) and logs it on the timeline. Calling it again returns the SAME links and changes nothing.',
  request: params,
  responses: { 200: okResponse('Links to share', sendProposalResponseSchema), 404: notFound },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/proposals/{id}/send-whatsapp',
  tags: TAG,
  security,
  summary:
    'Send the proposal to the customer as a WhatsApp message (and freeze it if it is a draft)',
  description:
    "Sends the approved `proposal_share` template with the customer's link. `phone` defaults to the lead's number; a different number only changes where this message goes. If WhatsApp sending is not set up, the proposal is still frozen and `delivery` is `not_configured`: use `whatsappUrl` instead.",
  request: {
    params: proposalIdParamsSchema,
    body: { content: { 'application/json': { schema: sendProposalWhatsappBodySchema } } },
  },
  responses: {
    200: okResponse('Sent, or ready to share', sendProposalWhatsappResponseSchema),
    404: notFound,
    503: errorResponse('WhatsApp could not send it (the proposal stays frozen)'),
  },
});

const tokenParams = { params: proposalTokenParamsSchema };
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/public/proposals/{token}',
  tags: PUBLIC_TAG,
  summary: "The customer's proposal page data (no login). Does NOT record a view",
  description: 'Chat apps fetch links to build previews, so loading this must not count as "seen".',
  request: tokenParams,
  responses: {
    200: okResponse('Proposal', publicProposalSchema),
    404: errorResponse('Unknown link, or still a draft'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/public/proposals/{token}/seen',
  tags: PUBLIC_TAG,
  summary: "The customer's browser reports the page rendered (counts a view)",
  description:
    'The first view alerts the sales person. Signed-in staff are never counted (so testing the link yourself does not look like a customer view). Always answers 200, whether or not it was counted.',
  request: tokenParams,
  responses: { 200: okResponse('Acknowledged', z.object({})) },
});

export interface ProposalsControllers {
  create: RequestHandler;
  list: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  duplicate: RequestHandler;
  send: RequestHandler;
  sendWhatsapp: RequestHandler;
}

export function buildProposalsRouter(c: ProposalsControllers): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN', 'SALES'));
  const id = validate({ params: proposalIdParamsSchema });
  router.post('/', validate({ body: createProposalBodySchema }), c.create);
  router.get('/', validate({ query: listProposalsQuerySchema }), c.list);
  router.get('/:id', id, c.get);
  router.patch(
    '/:id',
    validate({ params: proposalIdParamsSchema, body: updateProposalBodySchema }),
    c.update,
  );
  router.delete('/:id', id, c.remove);
  router.post('/:id/duplicate', id, c.duplicate);
  router.post('/:id/send', id, c.send);
  router.post(
    '/:id/send-whatsapp',
    validate({ params: proposalIdParamsSchema, body: sendProposalWhatsappBodySchema }),
    c.sendWhatsapp,
  );
  return router;
}

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      buildErrorBody(req, {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again shortly.',
      }),
    );
  },
});

export interface PublicProposalsControllers {
  get: RequestHandler;
  seen: RequestHandler;
}

export function buildPublicProposalsRouter(c: PublicProposalsControllers): Router {
  const router = Router();
  router.use(publicLimiter);
  const token = validate({ params: proposalTokenParamsSchema });
  router.get('/:token', token, c.get);
  router.post('/:token/seen', optionalAuthenticate, token, c.seen);
  return router;
}
