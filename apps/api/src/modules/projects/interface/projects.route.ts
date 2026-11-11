import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  changeDesignStageBodySchema,
  changeStageBodySchema,
  commentIdParamsSchema,
  commentSchema,
  createCommentBodySchema,
  createPostBodySchema,
  createProjectBodySchema,
  journeySchema,
  listPostsQuerySchema,
  listTimelineQuerySchema,
  timelinePageSchema,
  listProjectsQuerySchema,
  paginatedSchema,
  postIdParamsSchema,
  postPageSchema,
  postSchema,
  projectIdParamsSchema,
  projectSchema,
  setMembersBodySchema,
  updateProjectBodySchema,
  uploadTicketSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Projects'];
const FEED = ['Projects / Feed'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const idParams = { params: projectIdParamsSchema };
const postParams = { params: postIdParamsSchema };
const notFound = errorResponse('Not found (also returned when you are not part of the project)');

const doc = (
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  path: string,
  tags: string[],
  summary: string,
  request: Record<string, unknown> | undefined,
  responses: Record<string | number, unknown>,
  description?: string,
) =>
  openApiRegistry.registerPath({
    method,
    path,
    tags,
    security,
    summary,
    ...(description ? { description } : {}),
    ...(request ? { request } : {}),
    responses,
  } as never);

doc(
  'post',
  '/api/projects',
  TAG,
  'Create a project for an existing customer, or for a lead (Admin)',
  { body: json(createProjectBodySchema) },
  {
    201: okResponse('Created', projectSchema),
    400: errorResponse('Not an active customer'),
    404: notFound,
  },
  "Won leads get their project automatically. Use this for a repeat customer's new project, or to start one from a lead by hand. A customer can have any number of projects; a lead's latest sent proposal total becomes the value.",
);
doc(
  'get',
  '/api/projects',
  TAG,
  'List projects: Admin all; others only those they belong to',
  { query: listProjectsQuerySchema },
  { 200: okResponse('A page of projects', paginatedSchema(projectSchema)) },
  "Filters: stage, designStage, designerId (the design view), customerId, leadId, search. Anyone who may access a lead can list that lead's projects with `leadId` (a summary, never the feeds).",
);
doc('get', '/api/projects/{id}', TAG, 'One project (summary)', idParams, {
  200: okResponse('The project', projectSchema),
  404: notFound,
});
doc(
  'patch',
  '/api/projects/{id}',
  TAG,
  'Rename, set site address or value (Admin)',
  { ...idParams, body: json(updateProjectBodySchema) },
  { 200: okResponse('Updated', projectSchema), 404: notFound },
);
doc(
  'put',
  '/api/projects/{id}/members',
  TAG,
  'Replace the member list and set the designer (Admin)',
  { ...idParams, body: json(setMembersBodySchema) },
  { 200: okResponse('Updated', projectSchema), 400: errorResponse('Members must be active staff') },
  'New members are notified. The designer is always added as a member.',
);
doc(
  'post',
  '/api/projects/{id}/stage',
  TAG,
  'Move between DESIGN and SITE; also reopens a closed project (Admin)',
  { ...idParams, body: json(changeStageBodySchema) },
  { 200: okResponse('Updated', projectSchema) },
);
doc(
  'patch',
  '/api/projects/{id}/design-stage',
  TAG,
  "Set the design stage (Admin or the project's designer)",
  { ...idParams, body: json(changeDesignStageBodySchema) },
  { 200: okResponse('Updated', projectSchema), 403: errorResponse('Not the designer') },
);
doc(
  'post',
  '/api/projects/{id}/close',
  TAG,
  'Close the deal (Admin) — needs a Final Delivery post',
  idParams,
  {
    200: okResponse('Closed', projectSchema),
    409: errorResponse('No final delivery post yet, or already closed'),
  },
);
doc(
  'get',
  '/api/projects/{id}/journey',
  TAG,
  "The lead's story so far, oldest first (Admin and the lead's owner)",
  idParams,
  { 200: okResponse('Lead activities', journeySchema), 404: notFound },
  'Shown collapsed on the project. Empty for a project with no lead.',
);

doc(
  'post',
  '/api/projects/{id}/uploads/sign',
  FEED,
  'Get a signed ticket to upload photos straight to storage',
  idParams,
  {
    200: okResponse('Upload ticket', uploadTicketSchema),
    503: errorResponse('Storage not configured'),
  },
  'POST each file to `url` as multipart/form-data with the `fields` first and the file in `fileField`. Then send the returned `public_id` as `images[].publicId` when you create a post.',
);
doc(
  'get',
  '/api/projects/{id}/timeline',
  FEED,
  'Posts and team activity in ONE stream, newest first',
  { ...idParams, query: listTimelineQuerySchema },
  { 200: okResponse('A page of timeline items', timelinePageSchema), 404: notFound },
  'Each item is `{ kind: "POST", post }` or `{ kind: "ACTIVITY", activity }` (to-do created / assigned / due date changed / completed / reopened). The customer sees posts only, so their timeline is just the Client tab.',
);
doc(
  'get',
  '/api/projects/{id}/posts',
  FEED,
  'The feed, newest first (`visibility` = one tab; `before` = cursor)',
  { ...idParams, query: listPostsQuerySchema },
  { 200: okResponse('A page of posts', postPageSchema), 404: notFound },
  'The customer only ever sees CLIENT posts. Each post carries its comment count and the latest three comments.',
);
doc(
  'post',
  '/api/projects/{id}/posts',
  FEED,
  'Post text and/or photos',
  { ...idParams, body: json(createPostBodySchema) },
  {
    201: okResponse('Posted', postSchema),
    400: errorResponse('Empty post, or a photo from another project'),
    409: errorResponse('Project is closed'),
  },
  "Default visibility is TEAM, so nothing reaches the customer by accident. A customer's posts are always CLIENT. FINAL_DELIVERY needs a photo and is always CLIENT.",
);
doc(
  'delete',
  '/api/projects/{id}/posts/{postId}',
  FEED,
  'Delete a post (its author, or Admin)',
  postParams,
  { 200: okResponse('Deleted', z.object({})), 403: errorResponse('Not yours'), 404: notFound },
);
doc(
  'post',
  '/api/projects/{id}/posts/{postId}/approve',
  FEED,
  'The customer approves the design in a post',
  postParams,
  {
    200: okResponse('Approved', postSchema),
    400: errorResponse('Nothing to approve'),
    403: errorResponse('Customers only'),
  },
  'Once per post; repeating it changes and announces nothing.',
);
doc(
  'get',
  '/api/projects/{id}/posts/{postId}/comments',
  FEED,
  'The whole comment thread, oldest first',
  postParams,
  { 200: okResponse('Comments', z.array(commentSchema)), 404: notFound },
);
doc(
  'post',
  '/api/projects/{id}/posts/{postId}/comments',
  FEED,
  'Comment on a post',
  { ...postParams, body: json(createCommentBodySchema) },
  { 201: okResponse('Added', commentSchema), 404: notFound },
);
doc(
  'delete',
  '/api/projects/{id}/posts/{postId}/comments/{commentId}',
  FEED,
  'Delete a comment (its author, or Admin)',
  { params: commentIdParamsSchema },
  { 200: okResponse('Deleted', z.object({})), 403: errorResponse('Not yours') },
);

export interface ProjectsControllers {
  create: RequestHandler;
  list: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  setMembers: RequestHandler;
  changeStage: RequestHandler;
  changeDesignStage: RequestHandler;
  close: RequestHandler;
  journey: RequestHandler;
  signUpload: RequestHandler;
  timeline: RequestHandler;
  listPosts: RequestHandler;
  createPost: RequestHandler;
  deletePost: RequestHandler;
  approvePost: RequestHandler;
  listComments: RequestHandler;
  createComment: RequestHandler;
  deleteComment: RequestHandler;
}

export function buildProjectsRouter(c: ProjectsControllers): Router {
  const router = Router();
  router.use(authenticate);
  const id = validate({ params: projectIdParamsSchema });

  // Who may do what to WHICH project is decided by the data (member? customer? the lead's owner?)
  // inside the use cases. These role gates only cover what is Admin-only everywhere.
  router.post('/', requireRole('ADMIN'), validate({ body: createProjectBodySchema }), c.create);
  router.get('/', validate({ query: listProjectsQuerySchema }), c.list);
  router.get('/:id', id, c.get);
  router.patch(
    '/:id',
    requireRole('ADMIN'),
    validate({ params: projectIdParamsSchema, body: updateProjectBodySchema }),
    c.update,
  );
  router.put(
    '/:id/members',
    requireRole('ADMIN'),
    validate({ params: projectIdParamsSchema, body: setMembersBodySchema }),
    c.setMembers,
  );
  router.post(
    '/:id/stage',
    requireRole('ADMIN'),
    validate({ params: projectIdParamsSchema, body: changeStageBodySchema }),
    c.changeStage,
  );
  router.patch(
    '/:id/design-stage',
    requireRole('ADMIN', 'DESIGNER'),
    validate({ params: projectIdParamsSchema, body: changeDesignStageBodySchema }),
    c.changeDesignStage,
  );
  router.post('/:id/close', requireRole('ADMIN'), id, c.close);
  router.get('/:id/journey', id, c.journey);

  router.post('/:id/uploads/sign', id, c.signUpload);
  router.get(
    '/:id/timeline',
    validate({ params: projectIdParamsSchema, query: listTimelineQuerySchema }),
    c.timeline,
  );
  router.get(
    '/:id/posts',
    validate({ params: projectIdParamsSchema, query: listPostsQuerySchema }),
    c.listPosts,
  );
  router.post(
    '/:id/posts',
    validate({ params: projectIdParamsSchema, body: createPostBodySchema }),
    c.createPost,
  );
  router.delete('/:id/posts/:postId', validate({ params: postIdParamsSchema }), c.deletePost);
  router.post(
    '/:id/posts/:postId/approve',
    validate({ params: postIdParamsSchema }),
    c.approvePost,
  );
  router.get(
    '/:id/posts/:postId/comments',
    validate({ params: postIdParamsSchema }),
    c.listComments,
  );
  router.post(
    '/:id/posts/:postId/comments',
    validate({ params: postIdParamsSchema, body: createCommentBodySchema }),
    c.createComment,
  );
  router.delete(
    '/:id/posts/:postId/comments/:commentId',
    validate({ params: commentIdParamsSchema }),
    c.deleteComment,
  );
  return router;
}
