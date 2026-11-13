import type { NotificationRefDto, NotificationType } from '@vastu/contracts';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  ref?: NotificationRefDto;
  /** Makes the alert idempotent per person: the same key is never delivered to them twice. */
  dedupeKey?: string;
}

/** The only thing another module may import from `notifications/`. */
export interface NotificationsPublicContract {
  /** `created` is false when `dedupeKey` was already delivered to that person. */
  notify(input: NotifyInput): Promise<{ created: boolean }>;
  /** Stops push to every phone of a user (sign-out everywhere, deactivation). Returns how many. */
  removeDevicesFor(userId: string): Promise<number>;
}
