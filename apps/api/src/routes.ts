import { Router } from 'express';
import type { AppContainers } from './container.js';

/** Mounts every module's router under /api/<module>. */
export function buildApiRouter(containers: AppContainers): Router {
  const router = Router();
  router.use('/health', containers.health.buildRouter());
  router.use('/settings', containers.settings.buildRouter());
  router.use('/identity', containers.identity.buildRouter());
  router.use('/notifications', containers.notifications.buildRouter());
  router.use('/leads', containers.leads.buildRouter());
  router.use('/proposals', containers.proposals.buildRouter());
  router.use('/projects', containers.projects.buildRouter());
  router.use('/public/proposals', containers.proposals.buildPublicRouter());
  router.use('/complaints', containers.complaints.buildRouter());
  router.use('/reminders', containers.reminders.buildRouter());
  // To-dos own full paths (/projects/:id/todos, /todos/:id …), so this router is mounted at the root
  // of /api — and LAST, so it can never sit in front of another module's routes.
  router.use('/', containers.todos.buildRouter());
  router.use('/', containers.docs.buildRouter());
  return router;
}
