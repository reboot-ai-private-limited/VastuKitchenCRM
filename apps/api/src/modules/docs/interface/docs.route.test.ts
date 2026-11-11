import type { AddressInfo } from 'node:net';
import express, { Router, type RequestHandler } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken } from '@/shared/http/jwt.util.js';
import { buildDocsRouter, type DocsControllers } from './docs.route.js';

/**
 * REGRESSION (see todos.route.test.ts). The docs router is mounted at the root of /api, so it sees
 * every request. Each route must authenticate on its own, and only its own: a router-level guard
 * would answer 401 to public proposal links and the Swagger docs mounted after it.
 */
const ok: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};
const stubs = Object.fromEntries(
  [
    'sign',
    'listFolders',
    'createFolder',
    'updateFolder',
    'deleteFolder',
    'listFiles',
    'registerFile',
    'saveFromPhotos',
    'getFile',
    'updateFile',
    'deleteFile',
  ].map((k) => [k, ok]),
) as unknown as DocsControllers;

let base = '';
let server: ReturnType<ReturnType<typeof express>['listen']>;

beforeAll(async () => {
  const api = Router();
  api.get('/public/ping', ok);
  api.use('/', buildDocsRouter(stubs));
  api.get('/after-docs', ok);
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

describe('the root-mounted docs router', () => {
  it('leaves requests that are not its own alone (public routes before or after it stay public)', async () => {
    expect((await fetch(`${base}/public/ping`)).status).toBe(200);
    expect((await fetch(`${base}/after-docs`)).status).toBe(200);
    expect((await fetch(`${base}/docs/anything`)).status).toBe(404); // unknown, but NOT 401
  });

  it('still requires a login on its own routes', async () => {
    for (const path of [
      '/projects/p1/files',
      '/projects/p1/folders',
      '/files/abc',
      '/projects/p1/files/uploads/sign',
    ]) {
      const method = path.endsWith('/sign') ? 'POST' : 'GET';
      expect((await fetch(`${base}${path}`, { method })).status, path).toBe(401);
    }
    const token = signAccessToken('507f1f77bcf86cd799439011', 'DESIGNER');
    expect(
      (await fetch(`${base}/projects/p1/files`, { headers: { Authorization: `Bearer ${token}` } }))
        .status,
    ).toBe(200);
  });
});
