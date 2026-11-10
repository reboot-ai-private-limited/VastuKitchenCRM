import type { NotificationDto } from '@vastu/contracts';
import type { Notification } from '../domain/notification.entity.js';

export const toNotificationDto = (n: Notification): NotificationDto => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  ref: n.ref,
  readAt: n.readAt ? n.readAt.toISOString() : null,
  createdAt: n.createdAt.toISOString(),
});
