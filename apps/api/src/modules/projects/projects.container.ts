import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { NotificationsPublicContract } from '@/modules/notifications/notifications.public.js';
import type { ProposalsPublicContract } from '@/modules/proposals/proposals.public.js';
import type { SettingsPublicContract } from '@/modules/settings/settings.public.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import { FeedViewBuilder } from './application/services/feedViews.js';
import { ProjectAccess } from './application/services/projectAccess.js';
import { ProjectAlerts } from './application/services/projectAlerts.js';
import { ProjectViewBuilder } from './application/services/projectViews.js';
import {
  ApprovePostUseCase,
  CreateCommentUseCase,
  CreatePostUseCase,
  DeleteCommentUseCase,
  DeletePostUseCase,
  GetJourneyUseCase,
  ListCommentsUseCase,
  ListPostsUseCase,
  SignUploadUseCase,
} from './application/usecases/feed.usecases.js';
import {
  GetTimelineUseCase,
  ProjectContractUseCases,
} from './application/usecases/timeline.usecases.js';
import {
  ChangeDesignStageUseCase,
  ChangeStageUseCase,
  CloseProjectUseCase,
  CreateProjectFromWonLeadUseCase,
  CreateProjectUseCase,
  GetProjectUseCase,
  ListProjectsUseCase,
  SetMembersUseCase,
  UpdateProjectUseCase,
} from './application/usecases/projects.usecases.js';
import {
  IdentityUserDirectory,
  LeadsGateway,
  NotificationsAlertSender,
  ProposalsGateway,
  SettingsGateway,
} from './infrastructure/gateways.adapter.js';
import { MongoActivityRepository } from './infrastructure/mongoActivity.adapter.js';
import { MongoCommentRepository } from './infrastructure/mongoComment.adapter.js';
import { MongoProjectInsights } from './infrastructure/mongoInsights.adapter.js';
import { MongoPostRepository } from './infrastructure/mongoPost.adapter.js';
import { MongoProjectRepository } from './infrastructure/mongoProject.adapter.js';
import * as c from './interface/projects.controller.js';
import { buildProjectsRouter } from './interface/projects.route.js';
import type { ProjectsPublicContract } from './projects.public.js';

export interface ProjectsContainer {
  contract: ProjectsPublicContract;
  buildRouter: () => Router;
}

export interface ProjectsDeps {
  /** Other modules' public contracts: the only ways projects reaches them. */
  leads: LeadsPublicContract;
  proposals: ProposalsPublicContract;
  identity: IdentityPublicContract;
  notifications: NotificationsPublicContract;
  settings: SettingsPublicContract;
  storage: StoragePort;
}

export function buildProjectsContainer(deps: ProjectsDeps): ProjectsContainer {
  // 1. Adapters
  const projects = new MongoProjectRepository();
  const posts = new MongoPostRepository();
  const comments = new MongoCommentRepository();
  const activities = new MongoActivityRepository();
  const insights = new MongoProjectInsights();
  const leads = new LeadsGateway(deps.leads);
  const proposals = new ProposalsGateway(deps.proposals);
  const directory = new IdentityUserDirectory(deps.identity);
  const sender = new NotificationsAlertSender(deps.notifications);

  // 2. Services and use cases, depending only on ports
  const access = new ProjectAccess(projects, leads);
  const alerts = new ProjectAlerts(sender, directory);
  const projectViews = new ProjectViewBuilder(directory);
  const feedViews = new FeedViewBuilder(directory, comments, deps.storage);

  const contractUseCases = new ProjectContractUseCases(access, projects, activities);
  const fromWonLead = new CreateProjectFromWonLeadUseCase(
    projects,
    leads,
    proposals,
    new SettingsGateway(deps.settings),
    alerts,
  );

  return {
    contract: {
      createFromWonLead: (event) => fromWonLead.execute(event),
      getCustomerProjects: async (ids) =>
        (await projects.findByCustomerIds(ids)).map((p) => ({
          id: p.id,
          name: p.name,
          customerId: p.customerId,
          stage: p.stage,
          createdAt: p.createdAt,
        })),
      countByStage: () => insights.countByStage(),
      feedActivitySummary: (from, to) => insights.feedActivityByUser(from, to),
      recentCustomerActivity: (limit) => insights.recentCustomerActivity(limit),
      getMembership: (actor, projectId) => contractUseCases.getMembership(actor, projectId),
      getProjectAccess: (actor, projectId) => contractUseCases.getProjectAccess(actor, projectId),
      getProjectBasics: (projectId) => contractUseCases.basics(projectId),
      getProjectNames: (ids) => contractUseCases.names(ids),
      recordActivity: (projectId, activity) => contractUseCases.recordActivity(projectId, activity),
      filterAccessible: (actor, ids) => contractUseCases.filterAccessible(actor, ids),
    },
    buildRouter: () =>
      buildProjectsRouter({
        create: c.makeCreateProject(
          new CreateProjectUseCase(projects, leads, proposals, directory, alerts, projectViews),
        ),
        list: c.makeListProjects(new ListProjectsUseCase(projects, leads, projectViews)),
        get: c.makeGetProject(new GetProjectUseCase(access, projectViews)),
        update: c.makeUpdateProject(new UpdateProjectUseCase(access, projects, projectViews)),
        setMembers: c.makeSetMembers(
          new SetMembersUseCase(access, projects, directory, alerts, projectViews),
        ),
        changeStage: c.makeChangeStage(new ChangeStageUseCase(access, projects, projectViews)),
        changeDesignStage: c.makeChangeDesignStage(
          new ChangeDesignStageUseCase(access, projects, projectViews),
        ),
        close: c.makeCloseProject(
          new CloseProjectUseCase(access, projects, posts, leads, alerts, projectViews),
        ),
        journey: c.makeJourney(new GetJourneyUseCase(access, leads)),
        signUpload: c.makeSignUpload(new SignUploadUseCase(access, deps.storage)),
        timeline: c.makeTimeline(
          new GetTimelineUseCase(access, posts, activities, directory, feedViews),
        ),
        listPosts: c.makeListPosts(new ListPostsUseCase(access, posts, feedViews)),
        createPost: c.makeCreatePost(
          new CreatePostUseCase(access, posts, deps.storage, alerts, directory, feedViews),
        ),
        deletePost: c.makeDeletePost(new DeletePostUseCase(access, posts)),
        approvePost: c.makeApprovePost(
          new ApprovePostUseCase(access, posts, alerts, directory, feedViews),
        ),
        listComments: c.makeListComments(
          new ListCommentsUseCase(access, posts, comments, feedViews),
        ),
        createComment: c.makeCreateComment(
          new CreateCommentUseCase(
            access,
            posts,
            comments,
            alerts,
            directory,
            feedViews,
            deps.storage,
          ),
        ),
        deleteComment: c.makeDeleteComment(new DeleteCommentUseCase(access, posts, comments)),
      }),
  };
}
