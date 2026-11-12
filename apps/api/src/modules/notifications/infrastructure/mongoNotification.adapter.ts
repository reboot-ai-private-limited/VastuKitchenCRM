import { isValidObjectId, type HydratedDocument } from 'mongoose';
import { isDuplicateKey } from '@/shared/db/mongoErrors.js';
import type {
  NewNotification,
  Notification,
  NotificationListFilter,
} from '../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../domain/notification.repository.port.js';
import { NotificationModel, type NotificationDoc } from './notification.schema.js';

export const toEntity = (doc: HydratedDocument<NotificationDoc>): Notification => ({
  id: doc.id as string,
  userId: doc.userId.toString(),
  type: doc.type,
  title: doc.title,
  body: doc.body,
  ref: doc.ref
    ? {
        kind: doc.ref.kind,
        id: doc.ref.id,
        ...(doc.ref.postId ? { postId: doc.ref.postId } : {}),
        ...(doc.ref.projectId ? { projectId: doc.ref.projectId } : {}),
        ...(doc.ref.fileId ? { fileId: doc.ref.fileId } : {}),
      }
    : null,
  dedupeKey: doc.dedupeKey,
  readAt: doc.readAt,
  createdAt: doc.createdAt,
});

export class MongoNotificationRepository implements NotificationRepositoryPort {
  async createIfNew(notification: NewNotification): Promise<Notification | null> {
    try {
      return toEntity(await NotificationModel.create(notification));
    } catch (err) {
      // The unique (userId, dedupeKey) index says it was already delivered.
      if (isDuplicateKey(err)) return null;
      throw err;
    }
  }

  async list(userId: string, filter: NotificationListFilter) {
    if (!isValidObjectId(userId)) return { items: [], total: 0 };
    const query: Record<string, unknown> = { userId };
    if (filter.unreadOnly) query['readAt'] = null;
    const [docs, total] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((filter.page - 1) * filter.pageSize)
        .limit(filter.pageSize),
      NotificationModel.countDocuments(query),
    ]);
    return { items: docs.map(toEntity), total };
  }

  async countUnread(userId: string): Promise<number> {
    if (!isValidObjectId(userId)) return 0;
    return NotificationModel.countDocuments({ userId, readAt: null });
  }

  async markRead(userId: string, id: string, at: Date): Promise<boolean> {
    if (!isValidObjectId(userId) || !isValidObjectId(id)) return false;
    // Matching the owner in the filter means one person can never mark another's as read.
    const res = await NotificationModel.updateOne({ _id: id, userId }, { $set: { readAt: at } });
    return res.matchedCount === 1;
  }

  async markAllRead(userId: string, at: Date): Promise<number> {
    if (!isValidObjectId(userId)) return 0;
    const res = await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: at } },
    );
    return res.modifiedCount;
  }
}
