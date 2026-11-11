import type {
  CreateCommentBodyDto,
  CreatePostBodyDto,
  ListPostsQueryDto,
  PostVisibility,
  UploadTicketDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isInFolder, projectFolder } from '@/shared/storage/folders.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  ActorRef,
  CommentRepositoryPort,
  JourneyEntry,
  LeadsGatewayPort,
  PostRepositoryPort,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { Post } from '../../domain/post.entity.js';
import type { Project } from '../../domain/project.entity.js';
import type { CommentView, FeedViewBuilder, PostView } from '../services/feedViews.js';
import type { ProjectAccess, Viewer } from '../services/projectAccess.js';
import { visibleTabs } from '../services/projectAccess.js';
import type { ProjectAlerts } from '../services/projectAlerts.js';

const notFoundPost = () => AppError.notFound('Post not found.');

/** A post (or a comment on it) exists for this viewer only if they may see its tab. */
async function loadVisiblePost(
  posts: PostRepositoryPort,
  project: Project,
  viewer: Viewer,
  postId: string,
): Promise<Post> {
  const post = await posts.findById(postId);
  if (!post || post.projectId !== project.id || !visibleTabs(viewer).includes(post.visibility)) {
    throw notFoundPost();
  }
  return post;
}

export class ListPostsUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly views: FeedViewBuilder,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    query: ListPostsQueryDto,
  ): Promise<{ items: PostView[]; nextCursor: string | null }> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    const allowed = visibleTabs(viewer);
    if (query.visibility && !allowed.includes(query.visibility))
      throw AppError.notFound('Project not found.');

    let before: Date | undefined;
    if (query.before !== undefined) {
      before = new Date(query.before);
      if (Number.isNaN(before.getTime())) {
        throw AppError.badRequest('The cursor is not valid.', [
          { path: ['before'], message: 'Not a valid cursor' },
        ]);
      }
    }

    // One extra row tells us whether another page exists, without a count query.
    const rows = await this.posts.list({
      projectId,
      visibilities: query.visibility ? [query.visibility] : allowed,
      before,
      limit: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    return {
      items: await this.views.posts(project, viewer, page),
      nextCursor:
        rows.length > query.limit ? (page[page.length - 1]?.createdAt.toISOString() ?? null) : null,
    };
  }
}

export class CreatePostUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly storage: StoragePort,
    private readonly alerts: ProjectAlerts,
    private readonly directory: UserDirectoryPort,
    private readonly views: FeedViewBuilder,
  ) {}

  async execute(actor: ActorRef, projectId: string, input: CreatePostBodyDto): Promise<PostView> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    if (project.stage === 'CLOSED') throw AppError.conflict('This project is closed.');

    // The customer writes to the CLIENT tab only, and cannot mark a final delivery.
    if (viewer.isCustomer && input.kind === 'FINAL_DELIVERY') throw AppError.forbidden();
    let visibility: PostVisibility = viewer.isCustomer ? 'CLIENT' : input.visibility;
    // A final delivery is the customer's moment: it is always visible to them.
    if (input.kind === 'FINAL_DELIVERY') visibility = 'CLIENT';

    // Photos must have been uploaded into THIS project's folder: no other project's, no arbitrary ids.
    const folder = projectFolder(this.storage.rootFolder, project.id);
    input.images.forEach((image, index) => {
      if (!isInFolder(image.publicId, folder)) {
        throw AppError.badRequest('A photo does not belong to this project.', [
          { path: ['images', index, 'publicId'], message: 'Upload photos through this project' },
        ]);
      }
    });
    const seen = new Set<string>();
    const images = input.images
      .filter((i) => !seen.has(i.publicId) && !!seen.add(i.publicId))
      .map((i) => ({
        publicId: i.publicId,
        width: i.width ?? null,
        height: i.height ?? null,
        bytes: i.bytes ?? null,
      }));

    const post = await this.posts.create({
      projectId,
      authorId: actor.id,
      visibility,
      kind: input.kind,
      text: input.text ?? null,
      images,
    });

    const [author] = await this.directory.find([actor.id]);
    await this.alerts.postCreated(project, post, author?.name ?? 'Someone');
    return this.views.post(project, viewer, post);
  }
}

export class DeletePostUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
  ) {}

  async execute(actor: ActorRef, projectId: string, postId: string): Promise<void> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    const post = await loadVisiblePost(this.posts, project, viewer, postId);
    if (!viewer.isAdmin && post.authorId !== actor.id)
      throw AppError.forbidden('You can only delete your own posts.');
    if (!(await this.posts.softDelete(postId))) throw notFoundPost();
  }
}

/** The customer says "yes, this design". Once per post; repeating it changes and announces nothing. */
export class ApprovePostUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly alerts: ProjectAlerts,
    private readonly directory: UserDirectoryPort,
    private readonly views: FeedViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, projectId: string, postId: string): Promise<PostView> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    if (!viewer.isCustomer) throw AppError.forbidden('Only the customer can approve a design.');

    const post = await loadVisiblePost(this.posts, project, viewer, postId);
    if (
      post.visibility !== 'CLIENT' ||
      post.images.length === 0 ||
      post.authorId === project.customerId
    ) {
      throw AppError.badRequest('There is no design to approve on this post.');
    }

    // Atomic: of two simultaneous taps only one wins, and only the winner announces it.
    const approved = await this.posts.approve(postId, actor.id, this.now());
    if (approved) {
      const [customer] = await this.directory.find([actor.id]);
      await this.alerts.approved(project, approved, customer?.name ?? 'The customer');
    }
    const current = approved ?? (await this.posts.findById(postId));
    if (!current) throw notFoundPost();
    return this.views.post(project, viewer, current);
  }
}

export class CreateCommentUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly comments: CommentRepositoryPort,
    private readonly alerts: ProjectAlerts,
    private readonly directory: UserDirectoryPort,
    private readonly views: FeedViewBuilder,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    postId: string,
    input: CreateCommentBodyDto,
  ): Promise<CommentView> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    const post = await loadVisiblePost(this.posts, project, viewer, postId);

    const comment = await this.comments.create({
      postId,
      projectId,
      authorId: actor.id,
      text: input.text,
    });
    await this.posts.adjustCommentCount(postId, 1);

    const [author] = await this.directory.find([actor.id]);
    await this.alerts.commentCreated(project, post, comment, author?.name ?? 'Someone');
    return (await this.views.commentList(project, viewer, [comment]))[0]!;
  }
}

export class ListCommentsUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly comments: CommentRepositoryPort,
    private readonly views: FeedViewBuilder,
  ) {}

  async execute(actor: ActorRef, projectId: string, postId: string): Promise<CommentView[]> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    await loadVisiblePost(this.posts, project, viewer, postId);
    return this.views.commentList(project, viewer, await this.comments.listByPost(postId));
  }
}

export class DeleteCommentUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly posts: PostRepositoryPort,
    private readonly comments: CommentRepositoryPort,
  ) {}

  async execute(
    actor: ActorRef,
    projectId: string,
    postId: string,
    commentId: string,
  ): Promise<void> {
    const { project, viewer } = await this.access.loadAsMember(projectId, actor);
    await loadVisiblePost(this.posts, project, viewer, postId);

    const comment = await this.comments.findById(commentId);
    if (!comment || comment.postId !== postId) throw AppError.notFound('Comment not found.');
    if (!viewer.isAdmin && comment.authorId !== actor.id)
      throw AppError.forbidden('You can only delete your own comments.');
    if (await this.comments.softDelete(commentId)) await this.posts.adjustCommentCount(postId, -1);
  }
}

/** A ticket to upload photos into THIS project's folder, for anyone who may post here. */
export class SignUploadUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly storage: StoragePort,
  ) {}

  async execute(actor: ActorRef, projectId: string): Promise<UploadTicketDto> {
    const { project } = await this.access.loadAsMember(projectId, actor);
    if (project.stage === 'CLOSED') throw AppError.conflict('This project is closed.');
    return this.storage.signImageUpload(projectFolder(this.storage.rootFolder, project.id));
  }
}

/** The lead's story, oldest first — only for someone who may access the lead (Admin, or its Sales owner). */
export class GetJourneyUseCase {
  constructor(
    private readonly access: ProjectAccess,
    private readonly leads: LeadsGatewayPort,
  ) {}

  async execute(actor: ActorRef, projectId: string): Promise<JourneyEntry[]> {
    const { project } = await this.access.loadForSummary(projectId, actor);
    // A repeat customer's new project has no lead, so there is no journey to show.
    if (!project.leadId) return [];
    return this.leads.journey(actor, project.leadId);
  }
}
