import type { Request, RequestHandler } from 'express';
import type { ListTodosQueryDto, MyTodosQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { ActorRef } from '../domain/ports.js';
import type {
  CreateTodoCommentUseCase,
  DeleteTodoCommentUseCase,
  ListTodoCommentsUseCase,
} from '../application/usecases/comments.usecases.js';
import type {
  CreateTodoListUseCase,
  ListTodoListsUseCase,
  UpdateTodoListUseCase,
} from '../application/usecases/lists.usecases.js';
import type { MyTodosUseCase } from '../application/usecases/mine.usecase.js';
import type {
  CompleteTodoUseCase,
  CreateTodoUseCase,
  DeleteTodoUseCase,
  GetTodoUseCase,
  ListTodosUseCase,
  ReopenTodoUseCase,
  UpdateTodoUseCase,
} from '../application/usecases/todos.usecases.js';
import { toMyTodoDto, toTodoCommentDto, toTodoDto, toTodoListDto } from './todos.mapper.js';

function actorOf(req: Request): ActorRef {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const p = (req: Request, name: string): string => String(req.params[name]);

export const makeListLists = (uc: ListTodoListsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const archived = (req.query as { archived?: boolean }).archived ?? false;
    sendSuccess(
      req,
      res,
      (await uc.execute(actorOf(req), p(req, 'projectId'), archived)).map(toTodoListDto),
      'OK',
    );
  });

export const makeCreateList = (uc: CreateTodoListUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toTodoListDto(await uc.execute(actorOf(req), p(req, 'projectId'), req.body)),
      'List created.',
      201,
    );
  });

export const makeUpdateList = (uc: UpdateTodoListUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toTodoListDto(await uc.execute(actorOf(req), p(req, 'listId'), req.body)),
      'List updated.',
    );
  });

export const makeListTodos = (uc: ListTodosUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const items = await uc.execute(
      actorOf(req),
      p(req, 'projectId'),
      req.query as unknown as ListTodosQueryDto,
    );
    sendSuccess(req, res, items.map(toTodoDto), 'OK');
  });

export const makeCreateTodo = (uc: CreateTodoUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toTodoDto(await uc.execute(actorOf(req), p(req, 'listId'), req.body)),
      'To-do added.',
      201,
    );
  });

export const makeGetTodo = (uc: GetTodoUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toTodoDto(await uc.execute(actorOf(req), p(req, 'todoId'))), 'OK');
  });

export const makeUpdateTodo = (uc: UpdateTodoUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toTodoDto(await uc.execute(actorOf(req), p(req, 'todoId'), req.body)),
      'To-do updated.',
    );
  });

export const makeCompleteTodo = (uc: CompleteTodoUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toTodoDto(await uc.execute(actorOf(req), p(req, 'todoId'))),
      'Completed.',
    );
  });

export const makeReopenTodo = (uc: ReopenTodoUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toTodoDto(await uc.execute(actorOf(req), p(req, 'todoId'))), 'Reopened.');
  });

export const makeDeleteTodo = (uc: DeleteTodoUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(actorOf(req), p(req, 'todoId'));
    sendSuccess(req, res, {}, 'To-do deleted.');
  });

export const makeListComments = (uc: ListTodoCommentsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      (await uc.execute(actorOf(req), p(req, 'todoId'))).map(toTodoCommentDto),
      'OK',
    );
  });

export const makeCreateComment = (uc: CreateTodoCommentUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toTodoCommentDto(await uc.execute(actorOf(req), p(req, 'todoId'), req.body)),
      'Comment added.',
      201,
    );
  });

export const makeDeleteComment = (uc: DeleteTodoCommentUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(actorOf(req), p(req, 'todoId'), p(req, 'commentId'));
    sendSuccess(req, res, {}, 'Comment deleted.');
  });

export const makeMine = (uc: MyTodosUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      (await uc.execute(actorOf(req), req.query as unknown as MyTodosQueryDto)).map(toMyTodoDto),
      'OK',
    );
  });
