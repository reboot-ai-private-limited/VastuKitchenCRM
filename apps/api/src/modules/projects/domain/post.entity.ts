import type { PostKind, PostVisibility } from '@vastu/contracts';

export interface StoredImage {
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

export interface Post {
  id: string;
  projectId: string;
  authorId: string;
  visibility: PostVisibility;
  kind: PostKind;
  text: string | null;
  images: StoredImage[];
  /** Set once the customer approves the design. */
  approvedById: string | null;
  approvedAt: Date | null;
  /** Kept on the post so a feed page needs no extra count query. */
  commentCount: number;
  createdAt: Date;
}

export type NewPost = Omit<
  Post,
  'id' | 'createdAt' | 'commentCount' | 'approvedById' | 'approvedAt'
>;

export interface Comment {
  id: string;
  postId: string;
  projectId: string;
  authorId: string;
  text: string;
  createdAt: Date;
}

export type NewComment = Omit<Comment, 'id' | 'createdAt'>;

export interface PostListQuery {
  projectId: string;
  visibilities: PostVisibility[];
  /** Only posts created strictly before this moment (the cursor). */
  before?: Date | undefined;
  limit: number;
}
