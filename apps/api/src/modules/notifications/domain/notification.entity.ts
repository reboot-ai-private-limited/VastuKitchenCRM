import type { NotificationRefDto, NotificationType } from '@vastu/contracts';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  ref: NotificationRefDto | null;
  /** With `userId`, makes an alert idempotent: the same key is never delivered to a person twice. */
  dedupeKey: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export type NewNotification = Omit<Notification, 'id' | 'readAt' | 'createdAt'>;

export interface NotificationListFilter {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
}
