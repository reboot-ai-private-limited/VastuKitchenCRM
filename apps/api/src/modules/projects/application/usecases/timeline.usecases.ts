import type { ListTimelineQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { NewProjectActivity, ProjectActivity } from '../../domain/activity.entity.js';
import type {
  ActivityRepositoryPort,
  ActorRef,
  DirectoryUser,
  PostRepositoryPort,
  ProjectRepositoryPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { Post } from '../../domain/post.entity.js';
import type { FeedViewBuilder, PostView } from '../services/feedViews.js';
import type { ProjectAccess } from '../services/projectAccess.js';
import { visibleTabs } from '../services/projectAccess.js';

export type TimelineEntry =
  | { kind: 'POST'; at: Date; post: PostView }
  | { kind: 'ACTIVITY'; at: Date; activity: ProjectActivity; actorName: string | null };

/**
 * ONE stream of posts and team activity (to-do created / completed …), newest first. The customer
 * gets posts only (their CLIENT tab); staff get both. Paged by a time cursor: each source is read
 * one row past the page, so anything beyond the first `limit` merged rows is known to exist.
 */
export class GetTimelineUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly activities: ActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly feedViews: FeedViewBuilder,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    query: ListTimelineQueryDto,
  ): Promise<{ items: TimelineEntry[]; nextCursor: string | null }> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);

    let before: Date | undefined;
    if (query.before !== undefined) {
      before = new Date(query.before);
      if (Number.isNaN(before.getTime())) {
        throw AppError.badRequest('The cursor is not valid.', [
          { path: ['before'], message: 'Not a valid cursor' },
        ]);
      }
    }
    const take = query.limit + 1;

    const [posts, activities] = await Promise.all([
      this.posts.list({ projectId, visibilities: visibleTabs(viewer), before, limit: take }),
      viewer.isCustomer
        ? Promise.resolve([])
        : this.activities.list({ projectId, before, limit: take }),
    ]);

    const merged = [
      ...posts.map((p) => ({ kind: 'POST' as const, at: p.createdAt, post: p })),
      ...activities.map((a) => ({ kind: 'ACTIVITY' as const, at: a.at, activity: a })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    const page = merged.slice(0, query.limit);
    const pagePosts = page.flatMap((m) => (m.kind === 'POST' ? [m.post as Post] : []));
    const postViews = new Map(
      (await this.feedViews.posts(project, viewer, pagePosts)).map((v) => [v.post.id, v]),
    );
    const names = new Map<string, DirectoryUser>(
      (
        await this.directory.find([
          ...new Set(
            page.flatMap((m) =>
              m.kind === 'ACTIVITY' && m.activity.actorId ? [m.activity.actorId] : [],
            ),
          ),
        ])
      ).map((u) => [u.id, u]),
    );

    const items: TimelineEntry[] = page.map((m) =>
      m.kind === 'POST'
        ? { kind: 'POST', at: m.at, post: postViews.get(m.post.id)! }
        : {
            kind: 'ACTIVITY',
            at: m.at,
            activity: m.activity,
            actorName: m.activity.actorId ? (names.get(m.activity.actorId)?.name ?? null) : null,
          },
    );
    return {
      items,
      nextCursor:
        merged.length > query.limit ? (page[page.length - 1]?.at.toISOString() ?? null) : null,
    };
  }
}

/** What the to-dos module may do to a project, through the public contract. */
export class ProjectContractUseCases {
  constructor(
    private readonly access: ProjectAccess,
    private readonly projects: ProjectRepositoryPort,
    private readonly activities: ActivityRepositoryPort,
  ) {}

  /** Admin or member only: the customer has no to-dos (they are team-only). NOT FOUND for everyone else. */
  async getMembership(actor: ActorRef, projectId: string) {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    if (viewer.isCustomer) throw AppError.notFound('Project not found.');
    return {
      id: project.id,
      name: project.name,
      memberIds: project.memberIds,
      stage: project.stage,
    };
  }

  async recordActivity(
    projectId: string,
    activity: Omit<NewProjectActivity, 'projectId' | 'at'> & { at?: Date },
  ) {
    await this.activities.add({
      projectId,
      at: activity.at ?? new Date(),
      type: activity.type,
      actorId: activity.actorId,
      data: activity.data,
    });
  }

  async getProjectAccess(actor: ActorRef, projectId: string) {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    return {
      id: project.id,
      name: project.name,
      memberIds: project.memberIds,
      customerId: project.customerId,
      role: viewer.isAdmin
        ? ('ADMIN' as const)
        : viewer.isCustomer
          ? ('CUSTOMER' as const)
          : ('MEMBER' as const),
      stage: project.stage,
    };
  }

  async names(projectIds: string[]): Promise<Array<{ id: string; name: string }>> {
    if (projectIds.length === 0) return [];
    return (await this.projects.findByIds(projectIds)).map((p) => ({ id: p.id, name: p.name }));
  }

  /** Of these projects, the ones `actor` may use as staff (Admin: all; otherwise a member). With their names. */
  async filterAccessible(
    actor: ActorRef,
    projectIds: string[],
  ): Promise<Array<{ id: string; name: string }>> {
    if (projectIds.length === 0) return [];
    const found = await this.projects.findByIds(projectIds);
    const out: Array<{ id: string; name: string }> = [];
    for (const p of found) {
      const isAdmin = actor.role === 'ADMIN';
      if (isAdmin || p.memberIds.includes(actor.id)) out.push({ id: p.id, name: p.name });
    }
    return out;
  }
}
