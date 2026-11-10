import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from '@/config/env.js';
import { buildContainers, type AppContainers } from './container.js';
import { buildApiRouter } from './routes.js';
import { errorHandler, notFoundHandler } from '@/shared/http/error-handler.js';
import { requestIdMiddleware } from '@/shared/http/request-id.middleware.js';
import { mountSwagger } from '@/shared/http/swagger.util.js';

export interface CreateAppOptions {
  /** Called once with the built modules, for what the server runs besides requests (cron jobs). */
  onContainers?: (containers: AppContainers) => void;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Request-id FIRST so even a request rejected by helmet/cors is traceable.
  app.use(requestIdMiddleware());
  app.use(helmet());
  // `credentials: true` lets the browser send the refresh cookie; origins are an explicit allowlist.
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Client', 'X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Containers, then routers (importing a route file registers its OpenAPI paths), THEN swagger.
  const containers = buildContainers();
  options.onContainers?.(containers);
  app.use('/api', buildApiRouter(containers));
  mountSwagger(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
