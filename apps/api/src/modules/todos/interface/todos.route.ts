import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  createTodoBodySchema,
  createTodoCommentBodySchema,
  createTodoListBodySchema,
  listTodoListsQuerySchema,
  listTodosQuerySchema,
  myTodoSchema,
  myTodosQuerySchema,
  todoCommentParamsSchema,
  todoCommentSchema,
  todoIdParamsSchema,
  todoListParamsSchema,
  todoListSchema,
  todoProjectParamsSchema,
  todoSchema,
  updateTodoBodySchema,
  updateTodoListBodySchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['To-dos'];
const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const notFound = errorResponse(
  'Not found (also returned when you are not on the project: to-dos are team-only)',
);

const doc = (
  method: 'get' | 'post' | 'patch' | 'delete',
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

const project = { params: todoProjectParamsSchema };
const list = { params: todoListParamsSchema };
const todo = { params: todoIdParamsSchema };

doc(
  'get',
  '/api/projects/{projectId}/todo-lists',
  'To-do lists with "3/8 completed" counts',
  { ...project, query: listTodoListsQuerySchema },
  { 200: okResponse('Lists', z.array(todoListSchema)), 404: notFound },
  'Archived lists are left out unless `archived=true`.',
);
doc(
  'post',
  '/api/projects/{projectId}/todo-lists',
  'Add a to-do list',
  { ...project, body: json(createTodoListBodySchema) },
  { 201: okResponse('Created', todoListSchema), 404: notFound },
);
doc(
  'patch',
  '/api/todo-lists/{listId}',
  'Rename or archive a list',
  { ...list, body: json(updateTodoListBodySchema) },
  { 200: okResponse('Updated', todoListSchema), 404: notFound },
);
doc(
  'get',
  '/api/projects/{projectId}/todos',
  'To-dos of a project (`status` open/done/all, `listId`, `assignee` = me or a user id)',
  { ...project, query: listTodosQuerySchema },
  { 200: okResponse('To-dos, grouped by list order', z.array(todoSchema)), 404: notFound },
);
doc(
  'post',
  '/api/todo-lists/{listId}/todos',
  'Add a to-do',
  { ...list, body: json(createTodoBodySchema) },
  {
    201: okResponse('Created', todoSchema),
    400: errorResponse('Assignees must be on the project; photos must come from this project'),
    409: errorResponse('List is archived'),
    404: notFound,
  },
  'Assignees and the "notify when done" people must be active members of the project (or an Admin), so nobody gets an alert they cannot open. Assignees are told. The creator is always told on completion. `dueOn` is a plain date (`YYYY-MM-DD`) in the business timezone.',
);
doc(
  'get',
  '/api/todos/mine',
  'My assignments: everything assigned to me, across projects, most urgent first',
  { query: myTodosQuerySchema },
  { 200: okResponse('To-dos with their project, list and bucket', z.array(myTodoSchema)) },
  '`bucket` is OVERDUE, TODAY, UPCOMING or NO_DATE (completed items are NO_DATE). Projects I can no longer open are left out.',
);
doc('get', '/api/todos/{todoId}', 'One to-do', todo, {
  200: okResponse('The to-do', todoSchema),
  404: notFound,
});
doc(
  'patch',
  '/api/todos/{todoId}',
  'Edit: title, notes, photos, assignees, notify-when-done, due date, or move to another list',
  { ...todo, body: json(updateTodoBodySchema) },
  {
    200: okResponse('Updated', todoSchema),
    400: errorResponse('Not a member / not a list of this project'),
    404: notFound,
  },
  'New assignees are told. A changed due date tells the assignees. `null` clears notes or the due date. Both changes appear on the project timeline.',
);
doc(
  'post',
  '/api/todos/{todoId}/complete',
  'Mark completed',
  todo,
  { 200: okResponse('Completed', todoSchema), 404: notFound },
  'Tells the creator and everyone on the "notify when done" list, except you. Completing a completed to-do changes and announces nothing.',
);
doc('post', '/api/todos/{todoId}/reopen', 'Mark open again', todo, {
  200: okResponse('Reopened', todoSchema),
  404: notFound,
});
doc('delete', '/api/todos/{todoId}', 'Delete a to-do (its creator, or Admin)', todo, {
  200: okResponse('Deleted', z.object({})),
  403: errorResponse('Not yours'),
  404: notFound,
});
doc('get', '/api/todos/{todoId}/comments', 'The discussion, oldest first', todo, {
  200: okResponse('Comments', z.array(todoCommentSchema)),
  404: notFound,
});
doc(
  'post',
  '/api/todos/{todoId}/comments',
  'Comment',
  { ...todo, body: json(createTodoCommentBodySchema) },
  { 201: okResponse('Added', todoCommentSchema), 404: notFound },
  'Tells the assignees, the creator and earlier commenters, except you.',
);
doc(
  'delete',
  '/api/todos/{todoId}/comments/{commentId}',
  'Delete a comment (its author, or Admin)',
  { params: todoCommentParamsSchema },
  { 200: okResponse('Deleted', z.object({})), 403: errorResponse('Not yours') },
);

export interface TodosControllers {
  listLists: RequestHandler;
  createList: RequestHandler;
  updateList: RequestHandler;
  listTodos: RequestHandler;
  createTodo: RequestHandler;
  mine: RequestHandler;
  getTodo: RequestHandler;
  updateTodo: RequestHandler;
  complete: RequestHandler;
  reopen: RequestHandler;
  deleteTodo: RequestHandler;
  listComments: RequestHandler;
  createComment: RequestHandler;
  deleteComment: RequestHandler;
}

/**
 * Mounted at the ROOT of `/api` (the paths below are complete). Because of that, authentication is
 * applied PER ROUTE and never with `router.use(authenticate)`: a router-level guard would also catch
 * every request that merely passes through this router on its way elsewhere (the public proposal
 * links, the Swagger docs) and reject them with 401. Who may do what to WHICH project is decided by
 * membership inside the use cases; there is no role gate.
 */
export function buildTodosRouter(c: TodosControllers): Router {
  const router = Router();

  router.get(
    '/projects/:projectId/todo-lists',
    authenticate,
    validate({ params: todoProjectParamsSchema, query: listTodoListsQuerySchema }),
    c.listLists,
  );
  router.post(
    '/projects/:projectId/todo-lists',
    authenticate,
    validate({ params: todoProjectParamsSchema, body: createTodoListBodySchema }),
    c.createList,
  );
  router.patch(
    '/todo-lists/:listId',
    authenticate,
    validate({ params: todoListParamsSchema, body: updateTodoListBodySchema }),
    c.updateList,
  );
  router.get(
    '/projects/:projectId/todos',
    authenticate,
    validate({ params: todoProjectParamsSchema, query: listTodosQuerySchema }),
    c.listTodos,
  );
  router.post(
    '/todo-lists/:listId/todos',
    authenticate,
    validate({ params: todoListParamsSchema, body: createTodoBodySchema }),
    c.createTodo,
  );

  // Fixed path first, so "mine" is never read as a :todoId.
  router.get('/todos/mine', authenticate, validate({ query: myTodosQuerySchema }), c.mine);
  router.get('/todos/:todoId', authenticate, validate({ params: todoIdParamsSchema }), c.getTodo);
  router.patch(
    '/todos/:todoId',
    authenticate,
    validate({ params: todoIdParamsSchema, body: updateTodoBodySchema }),
    c.updateTodo,
  );
  router.post(
    '/todos/:todoId/complete',
    authenticate,
    validate({ params: todoIdParamsSchema }),
    c.complete,
  );
  router.post(
    '/todos/:todoId/reopen',
    authenticate,
    validate({ params: todoIdParamsSchema }),
    c.reopen,
  );
  router.delete(
    '/todos/:todoId',
    authenticate,
    validate({ params: todoIdParamsSchema }),
    c.deleteTodo,
  );
  router.get(
    '/todos/:todoId/comments',
    authenticate,
    validate({ params: todoIdParamsSchema }),
    c.listComments,
  );
  router.post(
    '/todos/:todoId/comments',
    authenticate,
    validate({ params: todoIdParamsSchema, body: createTodoCommentBodySchema }),
    c.createComment,
  );
  router.delete(
    '/todos/:todoId/comments/:commentId',
    authenticate,
    validate({ params: todoCommentParamsSchema }),
    c.deleteComment,
  );
  return router;
}
