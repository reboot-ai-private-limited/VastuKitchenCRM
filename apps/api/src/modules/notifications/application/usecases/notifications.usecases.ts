import type { ListNotificationsQueryDto, RegisterDeviceDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { logger } from '@/shared/logging/logger.js';
import { MAX_DEVICES_PER_USER, type Device } from '../../domain/device.entity.js';
import type { DeviceRepositoryPort } from '../../domain/device.repository.port.js';
import type { NewNotification, Notification } from '../../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../../domain/notification.repository.port.js';
import type { PushSenderPort } from '../../domain/pushSender.port.js';

/** Types that should wake a phone straight away. */
const HIGH_PRIORITY = new Set<string>([
  'LEAD_ASSIGNED',
  'COMPLAINT_RAISED',
  'COMPLAINT_ASSIGNED',
  'COMPLAINT_OVERDUE',
]);
/** More than this many pushes of one type to one person inside the window are folded into one. */
const BURST_LIMIT = 3;
const BURST_WINDOW_MS = 60_000;

export interface PushDeps {
  devices: DeviceRepositoryPort;
  sender: PushSenderPort;
  now?: () => Date;
}

/**
 * Delivers an in-app notification. `created` is false when the dedupeKey was already delivered.
 * A new row is also pushed to the person's phones, fire-and-forget: a push failure never fails the
 * business action that raised the alert.
 */
export class NotifyUseCase {
  /** userId:type -> recent push times, for coalescing a burst (a reminder run after downtime). */
  private readonly recent = new Map<string, number[]>();

  constructor(
    private readonly notifications: NotificationRepositoryPort,
    private readonly push?: PushDeps,
  ) {}

  async execute(input: NewNotification): Promise<{ created: boolean }> {
    const row = await this.notifications.createIfNew(input);
    if (row && this.push) void this.pushRow(row, this.push);
    return { created: row !== null };
  }

  private async pushRow(row: Notification, push: PushDeps): Promise<void> {
    try {
      const tokens = await push.devices.tokensFor(row.userId);
      if (tokens.length === 0) return;
      const mode = this.burstMode(row, (push.now ?? (() => new Date()))().getTime());
      if (mode === 'skip') return;
      const { deadTokens } = await push.sender.send(
        tokens,
        mode === 'summary'
          ? {
              title: 'Several updates',
              body: 'You have more new alerts. Open the app to see them.',
              data: { notificationId: null, type: row.type, ref: null },
              collapseId: `${row.userId}:${row.type}`,
              priority: 'normal',
            }
          : {
              title: row.title,
              body: row.body,
              data: { notificationId: row.id, type: row.type, ref: row.ref },
              priority: HIGH_PRIORITY.has(row.type) ? 'high' : 'normal',
            },
      );
      await push.devices.removeTokens(deadTokens);
    } catch (err) {
      logger.warn({ err }, 'Push failed (the in-app notification was still delivered)');
    }
  }

  private burstMode(row: Notification, nowMs: number): 'single' | 'summary' | 'skip' {
    const key = `${row.userId}:${row.type}`;
    const times = (this.recent.get(key) ?? []).filter((t) => nowMs - t < BURST_WINDOW_MS);
    times.push(nowMs);
    this.recent.set(key, times);
    if (this.recent.size > 5_000) {
      for (const [k, v] of this.recent)
        if (v.every((t) => nowMs - t >= BURST_WINDOW_MS)) this.recent.delete(k);
    }
    if (times.length <= BURST_LIMIT) return 'single';
    return times.length === BURST_LIMIT + 1 ? 'summary' : 'skip';
  }
}

export class RegisterDeviceUseCase {
  constructor(
    private readonly devices: DeviceRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  execute(userId: string, input: RegisterDeviceDto): Promise<Device> {
    return this.devices.register(
      userId,
      {
        token: input.pushToken,
        platform: input.platform,
        appVersion: input.appVersion ?? null,
        deviceName: input.deviceName ?? null,
      },
      this.now(),
      MAX_DEVICES_PER_USER,
    );
  }
}

export class RemoveDeviceUseCase {
  constructor(private readonly devices: DeviceRepositoryPort) {}

  async execute(userId: string, id: string): Promise<void> {
    if (!(await this.devices.remove(userId, id))) throw AppError.notFound('Device not found.');
  }
}

/** Forgets every phone of a user who was deactivated or deleted, so nothing more is pushed to them. */
export class RemoveUserDevicesUseCase {
  constructor(private readonly devices: DeviceRepositoryPort) {}

  execute(userId: string): Promise<number> {
    return this.devices.removeAllFor(userId);
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
