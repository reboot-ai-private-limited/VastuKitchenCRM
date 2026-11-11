import type { Types } from 'mongoose';
import { PROJECT_STAGES, type ProjectStage } from '@vastu/contracts';
import { ProjectCommentModel } from './projectComment.schema.js';
import { ProjectPostModel } from './projectPost.schema.js';
import { ProjectModel } from './project.schema.js';

export interface UserFeedActivity {
  userId: string;
  posts: number;
  comments: number;
  firstAt: Date;
  lastAt: Date;
}

export interface CustomerFeedItem {
  kind: 'POST' | 'COMMENT' | 'APPROVAL';
  at: Date;
  projectId: string;
  postId: string;
  authorId: string;
  /** The first words of the text, if any. */
  snippet: string | null;
  hasPhotos: boolean;
}

const snip = (t: string | null) => (t ? (t.length > 80 ? `${t.slice(0, 79)}…` : t) : null);

/** Read-only questions the dashboard asks of projects. */
export class MongoProjectInsights {
  async countByStage(): Promise<Record<ProjectStage, number>> {
    const rows = await ProjectModel.aggregate<{ _id: ProjectStage; n: number }>([
      { $group: { _id: '$stage', n: { $sum: 1 } } },
    ]);
    const out = Object.fromEntries(PROJECT_STAGES.map((s) => [s, 0])) as Record<
      ProjectStage,
      number
    >;
    for (const r of rows) if (r._id in out) out[r._id] = r.n;
    return out;
  }

  async feedActivityByUser(from: Date, to: Date): Promise<UserFeedActivity[]> {
    type Row = { _id: unknown; n: number; first: Date; last: Date };
    const group = {
      $group: {
        _id: '$authorId',
        n: { $sum: 1 },
        first: { $min: '$createdAt' },
        last: { $max: '$createdAt' },
      },
    };
    const match = { $match: { createdAt: { $gte: from, $lt: to }, deletedAt: null } };
    const [posts, comments] = await Promise.all([
      ProjectPostModel.aggregate<Row>([match, group]),
      ProjectCommentModel.aggregate<Row>([match, group]),
    ]);
    const by = new Map<string, UserFeedActivity>();
    const row = (id: string, first: Date, last: Date) => {
      const r = by.get(id) ?? { userId: id, posts: 0, comments: 0, firstAt: first, lastAt: last };
      if (first < r.firstAt) r.firstAt = first;
      if (last > r.lastAt) r.lastAt = last;
      by.set(id, r);
      return r;
    };
    for (const p of posts) row(String(p._id), p.first, p.last).posts = p.n;
    for (const c of comments) row(String(c._id), c.first, c.last).comments = c.n;
    return [...by.values()];
  }

  /**
   * The latest things CUSTOMERS did: their posts, their comments, and their approvals. A customer is
   * whoever is a project's `customerId`, so no role needs to be stored on a post.
   */
  async recentCustomerActivity(limit: number): Promise<CustomerFeedItem[]> {
    const customerIds = (await ProjectModel.distinct('customerId')) as Types.ObjectId[];
    if (customerIds.length === 0) return [];
    const [posts, comments, approvals] = await Promise.all([
      ProjectPostModel.find({ authorId: { $in: customerIds }, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(limit),
      ProjectCommentModel.find({ authorId: { $in: customerIds }, deletedAt: null })
        .sort({ createdAt: -1 })
        .limit(limit),
      ProjectPostModel.find({ approvedById: { $in: customerIds }, deletedAt: null })
        .sort({ approvedAt: -1 })
        .limit(limit),
    ]);
    const items: CustomerFeedItem[] = [
      ...posts.map((p) => ({
        kind: 'POST' as const,
        at: p.createdAt,
        projectId: p.projectId.toString(),
        postId: p.id as string,
        authorId: p.authorId.toString(),
        snippet: snip(p.text),
        hasPhotos: p.images.length > 0,
      })),
      ...comments.map((c) => ({
        kind: 'COMMENT' as const,
        at: c.createdAt,
        projectId: c.projectId.toString(),
        postId: c.postId.toString(),
        authorId: c.authorId.toString(),
        snippet: snip(c.text),
        hasPhotos: c.images.length > 0,
      })),
      ...approvals.map((p) => ({
        kind: 'APPROVAL' as const,
        at: p.approvedAt as Date,
        projectId: p.projectId.toString(),
        postId: p.id as string,
        authorId: String(p.approvedById),
        snippet: snip(p.text),
        hasPhotos: p.images.length > 0,
      })),
    ];
    return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  }
}
