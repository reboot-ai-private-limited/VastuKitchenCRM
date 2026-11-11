import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  CommentRepositoryPort,
  DirectoryUser,
  UserDirectoryPort,
} from '../../domain/ports.js';
import type { Comment, Post } from '../../domain/post.entity.js';
import type { Project } from '../../domain/project.entity.js';
import type { Viewer } from './projectAccess.js';

export interface CommentView {
  comment: Comment;
  authorName: string;
  authorIsCustomer: boolean;
  images: Array<{
    publicId: string;
    url: string;
    thumbUrl: string;
    width: number | null;
    height: number | null;
  }>;
  canDelete: boolean;
}

export interface PostView {
  post: Post;
  authorName: string;
  authorDesignation: string | null;
  authorIsCustomer: boolean;
  images: Array<{
    publicId: string;
    url: string;
    thumbUrl: string;
    width: number | null;
    height: number | null;
  }>;
  recentComments: CommentView[];
  approvedByName: string | null;
  canDelete: boolean;
  canApprove: boolean;
}

/** How many of the latest comments a feed page carries per post (open the post for the rest). */
export const RECENT_COMMENTS = 3;

export class FeedViewBuilder {
  constructor(
    private readonly directory: UserDirectoryPort,
    private readonly comments: CommentRepositoryPort,
    private readonly storage: StoragePort,
  ) {}

  async posts(project: Project, viewer: Viewer, posts: Post[]): Promise<PostView[]> {
    const recent = await this.comments.recentByPosts(
      posts.map((p) => p.id),
      RECENT_COMMENTS,
    );
    const ids = new Set<string>();
    for (const p of posts) {
      ids.add(p.authorId);
      if (p.approvedById) ids.add(p.approvedById);
      (recent.get(p.id) ?? []).forEach((c) => ids.add(c.authorId));
    }
    const users = await this.users([...ids]);

    return posts.map((post) => {
      const author = users.get(post.authorId);
      return {
        post,
        authorName: author?.name ?? 'Someone',
        authorDesignation: author?.designation ?? null,
        authorIsCustomer: post.authorId === project.customerId,
        images: post.images.map((img) => ({
          publicId: img.publicId,
          ...this.storage.imageUrls(img.publicId),
          width: img.width,
          height: img.height,
        })),
        recentComments: (recent.get(post.id) ?? []).map((c) =>
          this.commentView(project, viewer, c, users),
        ),
        approvedByName: post.approvedById ? (users.get(post.approvedById)?.name ?? null) : null,
        canDelete: viewer.isAdmin || post.authorId === viewer.actor.id,
        // The customer approves a design the team shared with them, once.
        canApprove:
          viewer.isCustomer &&
          post.visibility === 'CLIENT' &&
          post.images.length > 0 &&
          post.approvedAt === null &&
          post.authorId !== project.customerId,
      };
    });
  }

  async post(project: Project, viewer: Viewer, post: Post): Promise<PostView> {
    return (await this.posts(project, viewer, [post]))[0]!;
  }

  async commentList(project: Project, viewer: Viewer, comments: Comment[]): Promise<CommentView[]> {
    const users = await this.users([...new Set(comments.map((c) => c.authorId))]);
    return comments.map((c) => this.commentView(project, viewer, c, users));
  }

  private commentView(
    project: Project,
    viewer: Viewer,
    c: Comment,
    users: Map<string, DirectoryUser>,
  ): CommentView {
    return {
      comment: c,
      authorName: users.get(c.authorId)?.name ?? 'Someone',
      authorIsCustomer: c.authorId === project.customerId,
      images: c.images.map((img) => ({
        publicId: img.publicId,
        ...this.storage.imageUrls(img.publicId),
        width: img.width,
        height: img.height,
      })),
      canDelete: viewer.isAdmin || c.authorId === viewer.actor.id,
    };
  }

  private async users(ids: string[]): Promise<Map<string, DirectoryUser>> {
    return new Map((await this.directory.find(ids)).map((u) => [u.id, u]));
  }
}
