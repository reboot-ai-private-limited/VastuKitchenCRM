import type { AddressInfo } from 'node:net';
import express, { Router, type RequestHandler } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken } from '@/shared/http/jwt.util.js';
import { buildTodosRouter, type TodosControllers } from './todos.route.js';

/**
 * REGRESSION. The to-dos router is mounted at the root of /api, so it sees every request. It once
 * authenticated at router level, which answered 401 to the public proposal links and the Swagger
 * docs mounted after it. Each route must authenticate on its own, and only its own.
 */
const ok: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};
const stubs = Object.fromEntries(
  [
    'listLists',
    'createList',
    'updateList',
    'listTodos',
    'createTodo',
    'mine',
    'getTodo',
    'updateTodo',
    'complete',
    'reopen',
    'deleteTodo',
    'listComments',
    'createComment',
    'deleteComment',
  ].map((k) => [k, ok]),
) as unknown as TodosControllers;

let base = '';
let server: ReturnType<ReturnType<typeof express>['listen']>;

beforeAll(async () => {
  const api = Router();
  api.get('/public/ping', ok); //        a public route mounted BEFORE the to-dos router
  api.use('/', buildTodosRouter(stubs));
  api.get('/after-todos', ok); //        and one mounted AFTER it
  const app = express();
  app.use('/api', api);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => {
  server.close();
});

describe('the root-mounted to-dos router', () => {
  it('does not touch requests that are not its own (public routes before or after it stay public)', async () => {
    expect((await fetch(`${base}/public/ping`)).status).toBe(200);
    expect((await fetch(`${base}/after-todos`)).status).toBe(200);
    expect((await fetch(`${base}/docs/anything`)).status).toBe(404); // unknown, but NOT 401
  });

  it('still requires a login on its own routes', async () => {
    for (const path of [
      '/todos/mine',
      '/todos/abc',
      '/projects/p1/todos',
      '/projects/p1/todo-lists',
      '/todos/abc/comments',
    ]) {
      expect((await fetch(`${base}${path}`)).status, path).toBe(401);
    }
    const token = signAccessToken('507f1f77bcf86cd799439011', 'DESIGNER');
    const authed = await fetch(`${base}/todos/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(authed.status).toBe(200);
  });
});
