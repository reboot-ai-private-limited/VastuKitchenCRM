import type { ListNotificationsQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { NewNotification, Notification } from '../../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../../domain/notification.repository.port.js';
import type { PushFanout } from '../services/pushFanout.js';

/** Delivers an in-app notification. `created` is false when the dedupeKey was already delivered. */
/** Recurring reminders replace each other on the phone instead of piling up. */
const COLLAPSING_TYPES = new Set<Notification['type']>([
  'LEAD_STAGNANT',
  'PROPOSAL_UNSEEN',
  'PROPOSAL_NO_ACTION',
  'TODO_OVERDUE',
  'COMPLAINT_OVERDUE',
]);

export class NotifyUseCase {
  constructor(
    private readonly notifications: NotificationRepositoryPort,
    private readonly push?: PushFanout,
  ) {}

  async execute(input: NewNotification): Promise<{ created: boolean }> {
    const stored = await this.notifications.createIfNew(input);
    // A deduped notification was already delivered (and pushed): never push it twice.
    if (stored && this.push) {
      await this.push.deliver(stored, COLLAPSING_TYPES.has(stored.type) ? stored.type : undefined);
    }
    return { created: stored !== null };
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
