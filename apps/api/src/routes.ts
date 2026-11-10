import { Router } from 'express';
import type { AppContainers } from './container.js';

/** Mounts every module's router under /api/<module>. */
export function buildApiRouter(containers: AppContainers): Router {
  const router = Router();
  router.use('/health', containers.health.buildRouter());
  router.use('/identity', containers.identity.buildRouter());
  router.use('/leads', containers.leads.buildRouter());
  router.use('/proposals', containers.proposals.buildRouter());
  router.use('/public/proposals', containers.proposals.buildPublicRouter());
  return router;
}
