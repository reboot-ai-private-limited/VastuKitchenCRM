import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  deviceIdParamsSchema,
  deviceSchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  notificationPageSchema,
  readAllResultSchema,
  registerDeviceSchema,
  unreadCountSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const TAG = ['Notifications'];
const security = [{ bearerAuth: [] }];

openApiRegistry.registerPath({
  method: 'get',
  path: '/api/notifications',
  tags: TAG,
  security,
  summary: 'My notifications, newest first (`unread=true` for unread only)',
  request: { query: listNotificationsQuerySchema },
  responses: { 200: okResponse('A page of notifications', notificationPageSchema) },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/notifications/unread-count',
  tags: TAG,
  security,
  summary: 'How many unread notifications I have (the app polls this about every 30 seconds)',
  responses: { 200: okResponse('Count', unreadCountSchema) },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/notifications/read-all',
  tags: TAG,
  security,
  summary: 'Mark all my notifications as read',
  responses: { 200: okResponse('How many were marked', readAllResultSchema) },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/notifications/{id}/read',
  tags: TAG,
  security,
  summary: 'Mark one of my notifications as read',
  request: { params: notificationIdParamsSchema },
  responses: {
    200: okResponse('Marked', z.object({})),
    404: errorResponse('Not found (or not yours)'),
  },
});

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/notifications/devices',
  tags: TAG,
  security,
  summary: 'Register this phone for push (upsert by token; at most 5 per person, oldest dropped)',
  request: { body: { content: { 'application/json': { schema: registerDeviceSchema } } } },
  responses: { 200: okResponse('The device', deviceSchema) },
});
openApiRegistry.registerPath({
  method: 'delete',
  path: '/api/notifications/devices/{id}',
  tags: TAG,
  security,
  summary: 'Forget one of my devices (call on logout)',
  request: { params: deviceIdParamsSchema },
  responses: {
    200: okResponse('Removed', z.object({})),
    404: errorResponse('Not found (or not yours)'),
  },
});

export interface NotificationsControllers {
  list: RequestHandler;
  unreadCount: RequestHandler;
  markRead: RequestHandler;
  markAllRead: RequestHandler;
  registerDevice: RequestHandler;
  removeDevice: RequestHandler;
}

export function buildNotificationsRouter(c: NotificationsControllers): Router {
  const router = Router();
  // Every signed-in user (staff and customers) has their own notifications; no role gate.
  router.use(authenticate);
  router.get('/', validate({ query: listNotificationsQuerySchema }), c.list);
  router.get('/unread-count', c.unreadCount);
  // Fixed path before `/:id/read`, so "read-all" is never read as an id.
  router.post('/read-all', c.markAllRead);
  router.post('/:id/read', validate({ params: notificationIdParamsSchema }), c.markRead);
  router.post('/devices', validate({ body: registerDeviceSchema }), c.registerDevice);
  router.delete('/devices/:id', validate({ params: deviceIdParamsSchema }), c.removeDevice);
  return router;
}
