import type { Router } from 'express';
import { env } from '@/config/env.js';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import { todayIn } from '@/shared/time/businessDate.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import { TodoAccessService } from './application/services/todoAccess.js';
import { TodoAlerts } from './application/services/todoAlerts.js';
import { TodoViewBuilder } from './application/services/todoViews.js';
import {
  CreateTodoCommentUseCase,
  DeleteTodoCommentUseCase,
  ListTodoCommentsUseCase,
} from './application/usecases/comments.usecases.js';
import {
  CreateTodoListUseCase,
  ListTodoListsUseCase,
  UpdateTodoListUseCase,
} from './application/usecases/lists.usecases.js';
import { MyTodosUseCase } from './application/usecases/mine.usecase.js';
import { FindOverdueTodosUseCase } from './application/usecases/overdue.usecase.js';
import {
  CompleteTodoUseCase,
  CreateTodoUseCase,
  DeleteTodoUseCase,
  GetTodoUseCase,
  ListTodosUseCase,
  ReopenTodoUseCase,
  UpdateTodoUseCase,
} from './application/usecases/todos.usecases.js';
import {
  IdentityUserDirectory,
  NotificationsAlertSender,
  ProjectsGateway,
} from './infrastructure/gateways.adapter.js';
import {
  MongoTodoCommentRepository,
  MongoTodoListRepository,
  MongoTodoRepository,
} from './infrastructure/mongoTodo.adapters.js';
import * as c from './interface/todos.controller.js';
import { buildTodosRouter } from './interface/todos.route.js';
import type { TodosPublicContract } from './todos.public.js';

export interface TodosContainer {
  contract: TodosPublicContract;
  /** Mounted at `/api`: the router's paths are complete (`/projects/:id/todos`, `/todos/:id` …). */
  buildRouter: () => Router;
}

export interface TodosDeps {
  /** Other modules' public contracts: the only ways to-dos reaches them. */
  projects: ProjectsPublicContract;
  identity: IdentityPublicContract;
  notifications: NotificationsPublicContract;
  storage: StoragePort;
}

export function buildTodosContainer(deps: TodosDeps): TodosContainer {
  // 1. Adapters
  const lists = new MongoTodoListRepository();
  const todos = new MongoTodoRepository();
  const comments = new MongoTodoCommentRepository();
  const projects = new ProjectsGateway(deps.projects);
  const directory = new IdentityUserDirectory(deps.identity);
  const sender = new NotificationsAlertSender(deps.notifications);

  // 2. Services and use cases, depending only on ports
  const today = (now: Date) => todayIn(env.BUSINESS_TIMEZONE, now);
  const access = new TodoAccessService(todos, lists, projects);
  const alerts = new TodoAlerts(sender);
  const views = new TodoViewBuilder(directory, deps.storage, today);

  const overdue = new FindOverdueTodosUseCase(todos, projects, today);

  return {
    contract: { findOverdue: (window) => overdue.execute(window) },
    buildRouter: () =>
      buildTodosRouter({
        listLists: c.makeListLists(new ListTodoListsUseCase(access, lists, todos)),
        createList: c.makeCreateList(new CreateTodoListUseCase(access, lists)),
        updateList: c.makeUpdateList(new UpdateTodoListUseCase(access, lists, todos)),
        listTodos: c.makeListTodos(new ListTodosUseCase(access, todos, views)),
        createTodo: c.makeCreateTodo(
          new CreateTodoUseCase(access, todos, projects, directory, deps.storage, alerts, views),
        ),
        mine: c.makeMine(new MyTodosUseCase(todos, lists, projects, views, today)),
        getTodo: c.makeGetTodo(new GetTodoUseCase(access, views)),
        updateTodo: c.makeUpdateTodo(
          new UpdateTodoUseCase(
            access,
            todos,
            lists,
            projects,
            directory,
            deps.storage,
            alerts,
            views,
          ),
        ),
        complete: c.makeCompleteTodo(
          new CompleteTodoUseCase(access, todos, projects, directory, alerts, views),
        ),
        reopen: c.makeReopenTodo(new ReopenTodoUseCase(access, todos, projects, views)),
        deleteTodo: c.makeDeleteTodo(new DeleteTodoUseCase(access, todos)),
        listComments: c.makeListComments(
          new ListTodoCommentsUseCase(access, comments, directory, deps.storage),
        ),
        createComment: c.makeCreateComment(
          new CreateTodoCommentUseCase(access, comments, todos, directory, alerts, deps.storage),
        ),
        deleteComment: c.makeDeleteComment(new DeleteTodoCommentUseCase(access, comments, todos)),
      }),
  };
}
