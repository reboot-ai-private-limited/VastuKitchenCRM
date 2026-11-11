import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  CLIENT_KINDS,
  changePasswordBodySchema,
  loginBodySchema,
  loginResponseSchema,
  logoutBodySchema,
  redeemInviteBodySchema,
  refreshBodySchema,
  authTokensSchema,
  userSchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { buildErrorBody } from '@/shared/http/response.util.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const clientHeader = z.object({
  'x-client': z.enum(CLIENT_KINDS).openapi({
    description:
      '`web`: refresh token is set as an httpOnly cookie. `mobile`: refresh token is returned in the body.',
  }),
});
const bearer = [{ bearerAuth: [] }];
const TAG = ['Identity / Auth'];

openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/auth/login',
  tags: TAG,
  summary: 'Sign in with phone number and password',
  request: {
    headers: clientHeader,
    body: { content: { 'application/json': { schema: loginBodySchema } } },
  },
  responses: {
    200: okResponse('Signed in', loginResponseSchema),
    401: errorResponse('Incorrect phone number or password (also: no login, or deactivated)'),
    429: errorResponse('Too many attempts'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/auth/refresh',
  tags: TAG,
  summary: 'Rotate the refresh token and get a new access token',
  description:
    'Web: send no body; the refresh cookie is used. Mobile: send `{ refreshToken }`. The old refresh token stops working.',
  request: {
    headers: clientHeader,
    body: { content: { 'application/json': { schema: refreshBodySchema } }, required: false },
  },
  responses: {
    200: okResponse('New tokens', authTokensSchema),
    401: errorResponse('Session expired'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/auth/logout',
  tags: TAG,
  summary: 'Sign out this device',
  request: {
    headers: clientHeader,
    body: { content: { 'application/json': { schema: logoutBodySchema } }, required: false },
  },
  responses: { 200: okResponse('Signed out', z.object({})) },
});
openApiRegistry.registerPath({
  method: 'get',
  path: '/api/identity/auth/me',
  tags: TAG,
  summary: 'The signed-in user',
  security: bearer,
  responses: { 200: okResponse('Current user', userSchema), 401: errorResponse('Not signed in') },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/auth/change-password',
  tags: TAG,
  summary: 'Change your own password (signs you out everywhere)',
  security: bearer,
  request: { body: { content: { 'application/json': { schema: changePasswordBodySchema } } } },
  responses: {
    200: okResponse('Changed', z.object({})),
    400: errorResponse('Current password is wrong'),
  },
});
openApiRegistry.registerPath({
  method: 'post',
  path: '/api/identity/auth/invite/redeem',
  tags: TAG,
  summary: 'Customer: sign in with a one-time invite link token',
  request: {
    headers: clientHeader,
    body: { content: { 'application/json': { schema: redeemInviteBodySchema } } },
  },
  responses: {
    200: okResponse('Signed in', loginResponseSchema),
    401: errorResponse('Link expired or used'),
  },
});

/**
 * Brute-force protection: 30 FAILED attempts per IP per 15 minutes. Only failures count — a whole
 * office signing in at 9 am from one Wi-Fi address (one IP for 50 people) must not lock itself out.
 */
const attemptsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      buildErrorBody(req, {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait a few minutes and try again.',
      }),
    );
  },
});

export interface AuthControllers {
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
  changePassword: RequestHandler;
  redeemInvite: RequestHandler;
}

export function buildAuthRouter(c: AuthControllers): Router {
  const router = Router();
  router.post('/login', attemptsLimiter, validate({ body: loginBodySchema }), c.login);
  router.post('/refresh', c.refresh);
  router.post('/logout', c.logout);
  router.get('/me', authenticate, c.me);
  router.post(
    '/change-password',
    authenticate,
    validate({ body: changePasswordBodySchema }),
    c.changePassword,
  );
  router.post(
    '/invite/redeem',
    attemptsLimiter,
    validate({ body: redeemInviteBodySchema }),
    c.redeemInvite,
  );
  return router;
}
