import type {
  NewNotification,
  Notification,
  NotificationListFilter,
} from './notification.entity.js';

export interface NotificationRepositoryPort {
  /**
   * Stores the notification unless one with the same (userId, dedupeKey) already exists, in which
   * case it returns null. Atomic, so two simultaneous reminder runs cannot both deliver it.
   */
  createIfNew(notification: NewNotification): Promise<Notification | null>;
  list(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<{ items: Notification[]; total: number }>;
  countUnread(userId: string): Promise<number>;
  /** Marks one of the user's own notifications read. False when it is not theirs or does not exist. */
  markRead(userId: string, id: string, at: Date): Promise<boolean>;
  markAllRead(userId: string, at: Date): Promise<number>;
}
