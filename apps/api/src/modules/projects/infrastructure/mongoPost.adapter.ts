import { isValidObjectId, type HydratedDocument } from 'mongoose';
import type { PostRepositoryPort } from '../domain/ports.js';
import type { NewPost, Post, PostListQuery } from '../domain/post.entity.js';
import { ProjectPostModel, type ProjectPostDoc } from './projectPost.schema.js';

export function toPost(doc: HydratedDocument<ProjectPostDoc>): Post {
  return {
    id: doc.id as string,
    projectId: doc.projectId.toString(),
    authorId: doc.authorId.toString(),
    visibility: doc.visibility,
    kind: doc.kind,
    text: doc.text,
    images: doc.images.map((i) => ({
      publicId: i.publicId,
      width: i.width,
      height: i.height,
      bytes: i.bytes,
    })),
    approvedById: doc.approvedById ? doc.approvedById.toString() : null,
    approvedAt: doc.approvedAt,
    commentCount: doc.commentCount,
    createdAt: doc.createdAt,
  };
}

export class MongoPostRepository implements PostRepositoryPort {
  async create(post: NewPost): Promise<Post> {
    return toPost(await ProjectPostModel.create(post));
  }

  async findById(id: string): Promise<Post | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ProjectPostModel.findOne({ _id: id, deletedAt: null });
    return doc ? toPost(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await ProjectPostModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  }

  async list(q: PostListQuery): Promise<Post[]> {
    const filter: Record<string, unknown> = {
      projectId: q.projectId,
      deletedAt: null,
      visibility: { $in: q.visibilities },
    };
    if (q.before) filter['createdAt'] = { $lt: q.before };
    const docs = await ProjectPostModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(q.limit);
    return docs.map(toPost);
  }

  async approve(id: string, byId: string, at: Date): Promise<Post | null> {
    if (!isValidObjectId(id)) return null;
    // `approvedAt: null` in the filter: only the first approval matches, so only it can announce.
    const doc = await ProjectPostModel.findOneAndUpdate(
      { _id: id, deletedAt: null, approvedAt: null },
      { $set: { approvedById: byId, approvedAt: at } },
      { new: true },
    );
    return doc ? toPost(doc) : null;
  }

  async hasFinalDelivery(projectId: string): Promise<boolean> {
    if (!isValidObjectId(projectId)) return false;
    return (
      (await ProjectPostModel.exists({ projectId, kind: 'FINAL_DELIVERY', deletedAt: null })) !==
      null
    );
  }

  async adjustCommentCount(id: string, delta: 1 | -1): Promise<void> {
    if (!isValidObjectId(id)) return;
    await ProjectPostModel.updateOne({ _id: id }, { $inc: { commentCount: delta } });
  }
}
