import type { NotificationRefDto, NotificationType } from '@vastu/contracts';

export interface PushMessage {
  title: string;
  body: string;
  /** IDs only: the app builds the route itself. */
  data: { notificationId: string | null; type: NotificationType; ref: NotificationRefDto | null };
  /** Same id replaces an earlier push on the phone. */
  collapseId?: string;
  priority: 'high' | 'normal';
}

/**
 * Sends a push to a person's devices. Swappable (Expo today; FCM/APNs direct later).
 * Returns the tokens the service reported as permanently dead, so the caller can forget them.
 */
export interface PushSenderPort {
  send(tokens: string[], message: PushMessage): Promise<{ deadTokens: string[] }>;
}
