import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProjectsPublicContract } from '@/modules/projects/projects.public.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import { ComplaintAccess } from './application/services/complaintAccess.js';
import { ComplaintAlerts } from './application/services/complaintAlerts.js';
import { ComplaintViewBuilder } from './application/services/complaintViews.js';
import {
  AddComplaintCommentUseCase,
  AssignComplaintUseCase,
  CloseComplaintUseCase,
  CountComplaintsUseCase,
  DeleteComplaintCommentUseCase,
  FindStaleComplaintsUseCase,
  GetComplaintUseCase,
  ListComplaintsUseCase,
  RaiseComplaintUseCase,
  RaiseRules,
  ReopenComplaintUseCase,
  ResolveComplaintUseCase,
  SignRaiseUploadUseCase,
  SignResolveUploadUseCase,
  SignCommentUploadUseCase,
} from './application/usecases/complaints.usecases.js';
import {
  IdentityUserDirectory,
  NotificationsAlertSender,
  ProjectsGateway,
} from './infrastructure/gateways.adapter.js';
import { MongoComplaintRepository } from './infrastructure/mongoComplaint.adapter.js';
import * as c from './interface/complaints.controller.js';
import { buildComplaintsRouter } from './interface/complaints.route.js';
import type { ComplaintsPublicContract } from './complaints.public.js';

export interface ComplaintsContainer {
  contract: ComplaintsPublicContract;
  /** Mounted at `/api/complaints`. */
  buildRouter: () => Router;
}

export interface ComplaintsDeps {
  /** Other modules' public contracts: the only ways complaints reaches them. */
  projects: ProjectsPublicContract;
  identity: IdentityPublicContract;
  notifications: NotificationsPublicContract;
  storage: StoragePort;
}

export function buildComplaintsContainer(deps: ComplaintsDeps): ComplaintsContainer {
  // 1. Adapters
  const complaints = new MongoComplaintRepository();
  const projects = new ProjectsGateway(deps.projects);
  const directory = new IdentityUserDirectory(deps.identity);
  const sender = new NotificationsAlertSender(deps.notifications);

  // 2. Services and use cases, depending only on ports
  const access = new ComplaintAccess(complaints);
  const alerts = new ComplaintAlerts(sender, directory);
  const views = new ComplaintViewBuilder(directory, projects, deps.storage, access);
  const rules = new RaiseRules(projects, access);
  const stale = new FindStaleComplaintsUseCase(complaints);
  const now = () => new Date();

  return {
    contract: {
      countByStatus: () => complaints.counts({}),
      async findStale({ before, limit }) {
        const found = await stale.execute(before, limit);
        const names = new Map(
          (await projects.names([...new Set(found.map((x) => x.projectId))])).map((p) => [
            p.id,
            p.name,
          ]),
        );
        return found.map((x) => ({
          id: x.id,
          projectId: x.projectId,
          projectName: names.get(x.projectId) ?? 'Project',
          description: x.description,
          assignedToId: x.assignedToId,
          reopenCount: x.reopenCount,
          activeSince: x.activeSince,
        }));
      },
    },
    buildRouter: () =>
      buildComplaintsRouter({
        signRaise: c.makeSignRaise(new SignRaiseUploadUseCase(rules, deps.storage)),
        signResolve: c.makeSignResolve(new SignResolveUploadUseCase(access, deps.storage)),
        signComment: c.makeSignComment(new SignCommentUploadUseCase(access, deps.storage)),
        raise: c.makeRaise(
          new RaiseComplaintUseCase(
            rules,
            complaints,
            projects,
            directory,
            deps.storage,
            alerts,
            views,
            now,
          ),
        ),
        list: c.makeList(new ListComplaintsUseCase(access, complaints, views)),
        counts: c.makeCounts(new CountComplaintsUseCase(access, complaints)),
        get: c.makeGet(new GetComplaintUseCase(access, views)),
        assign: c.makeAssign(
          new AssignComplaintUseCase(access, complaints, projects, directory, views, alerts, now),
        ),
        resolve: c.makeResolve(
          new ResolveComplaintUseCase(
            access,
            complaints,
            projects,
            directory,
            views,
            deps.storage,
            alerts,
            now,
          ),
        ),
        reopen: c.makeReopen(
          new ReopenComplaintUseCase(access, complaints, projects, directory, views, alerts, now),
        ),
        close: c.makeClose(
          new CloseComplaintUseCase(access, complaints, projects, directory, views, alerts, now),
        ),
        addComment: c.makeAddComment(
          new AddComplaintCommentUseCase(
            access,
            complaints,
            projects,
            directory,
            deps.storage,
            alerts,
            views,
            now,
          ),
        ),
        deleteComment: c.makeDeleteComment(
          new DeleteComplaintCommentUseCase(access, complaints, views),
        ),
      }),
  };
}
