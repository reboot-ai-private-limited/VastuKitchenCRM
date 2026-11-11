import { Types, isValidObjectId, type HydratedDocument } from 'mongoose';
import type { CommentRepositoryPort } from '../domain/ports.js';
import type { Comment, NewComment } from '../domain/post.entity.js';
import { ProjectCommentModel, type ProjectCommentDoc } from './projectComment.schema.js';

const toComment = (doc: HydratedDocument<ProjectCommentDoc>): Comment => ({
  id: doc.id as string,
  postId: doc.postId.toString(),
  projectId: doc.projectId.toString(),
  authorId: doc.authorId.toString(),
  text: doc.text,
  images: doc.images.map((i) => ({
    publicId: i.publicId,
    width: i.width,
    height: i.height,
    bytes: i.bytes,
  })),
  createdAt: doc.createdAt,
});

export class MongoCommentRepository implements CommentRepositoryPort {
  async create(comment: NewComment): Promise<Comment> {
    return toComment(await ProjectCommentModel.create(comment));
  }

  async findById(id: string): Promise<Comment | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ProjectCommentModel.findOne({ _id: id, deletedAt: null });
    return doc ? toComment(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await ProjectCommentModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    );
    return res.modifiedCount === 1;
  }

  async listByPost(postId: string): Promise<Comment[]> {
    if (!isValidObjectId(postId)) return [];
    // A thread is a chat: oldest first. Bounded, so one runaway post cannot flood a response.
    const docs = await ProjectCommentModel.find({ postId, deletedAt: null })
      .sort({ createdAt: 1, _id: 1 })
      .limit(500);
    return docs.map(toComment);
  }

  async recentByPosts(postIds: string[], n: number): Promise<Map<string, Comment[]>> {
    const valid = postIds.filter((id) => isValidObjectId(id));
    const result = new Map<string, Comment[]>();
    if (valid.length === 0) return result;

    interface RawComment extends ProjectCommentDoc {
      _id: Types.ObjectId;
    }
    // `$topN` (MongoDB 5.2+) keeps only the latest n per post inside the database.
    const rows = await ProjectCommentModel.aggregate<{ _id: Types.ObjectId; items: RawComment[] }>([
      { $match: { postId: { $in: valid.map((id) => new Types.ObjectId(id)) }, deletedAt: null } },
      {
        $group: {
          _id: '$postId',
          items: { $topN: { n, sortBy: { createdAt: -1, _id: -1 }, output: '$$ROOT' } },
        },
      },
    ]);

    for (const row of rows) {
      result.set(
        row._id.toString(),
        row.items
          .map((d) => ({
            id: d._id.toString(),
            postId: d.postId.toString(),
            projectId: d.projectId.toString(),
            authorId: d.authorId.toString(),
            text: d.text,
            images: (d.images ?? []).map((i) => ({
              publicId: i.publicId,
              width: i.width,
              height: i.height,
              bytes: i.bytes,
            })),
            createdAt: d.createdAt,
          }))
          // Oldest first, the order a chat is read in.
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      );
    }
    return result;
  }
}
