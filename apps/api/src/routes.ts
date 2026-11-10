import { Router } from 'express';
import type { AppContainers } from './container.js';

/** Mounts every module's router under /api/<module>. */
export function buildApiRouter(containers: AppContainers): Router {
  const router = Router();
  router.use('/health', containers.health.buildRouter());
  router.use('/identity', containers.identity.buildRouter());
  return router;
}
