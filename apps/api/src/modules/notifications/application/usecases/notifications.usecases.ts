import type { ListNotificationsQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { NewNotification, Notification } from '../../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../../domain/notification.repository.port.js';

/** Delivers an in-app notification. `created` is false when the dedupeKey was already delivered. */
export class NotifyUseCase {
  constructor(private readonly notifications: NotificationRepositoryPort) {}

  async execute(input: NewNotification): Promise<{ created: boolean }> {
    return { created: (await this.notifications.createIfNew(input)) !== null };
  }
}

export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepositoryPort) {}

  execute(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<{ items: Notification[]; total: number }> {
    return this.notifications.list(userId, {
      page: query.page,
      pageSize: query.pageSize,
      unreadOnly: query.unread === true,
    });
  }
}

export class CountUnreadUseCase {
  constructor(private readonly notifications: NotificationRepositoryPort) {}

  execute(userId: string): Promise<number> {
    return this.notifications.countUnread(userId);
  }
}

export class MarkReadUseCase {
  constructor(
    private readonly notifications: NotificationRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    // Someone else's notification is reported as not found, like everywhere else.
    if (!(await this.notifications.markRead(userId, id, this.now()))) {
      throw AppError.notFound('Notification not found.');
    }
  }
}

export class MarkAllReadUseCase {
  constructor(
    private readonly notifications: NotificationRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(userId: string): Promise<number> {
    return this.notifications.markAllRead(userId, this.now());
  }
}
