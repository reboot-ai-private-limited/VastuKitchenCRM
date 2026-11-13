import { logger } from '@/shared/logging/logger.js';
import type { DeviceRepositoryPort } from '../../domain/device.repository.port.js';
import type { Notification } from '../../domain/notification.entity.js';
import type { PushSenderPort } from '../../domain/pushSender.port.js';

/** Android channel per notification family; the app creates the channels with these ids. */
export function channelFor(type: Notification['type']): string {
  if (type.startsWith('LEAD_') || type.startsWith('PROPOSAL_')) return 'sales';
  if (type.startsWith('PROJECT_') || type.startsWith('FILE_')) return 'projects';
  return 'general';
}

/** Sends a stored notification to the person's phones. Never throws: push is best-effort. */
export class PushFanout {
  constructor(
    private readonly devices: DeviceRepositoryPort,
    private readonly sender: PushSenderPort,
  ) {}

  async deliver(n: Notification, collapseKey?: string): Promise<void> {
    try {
      const tokens = await this.devices.listFcmTokens(n.userId);
      if (tokens.length === 0) return;
      const data: Record<string, string> = { notificationId: n.id, type: n.type };
      if (n.ref) {
        data['refKind'] = n.ref.kind;
        data['refId'] = n.ref.id;
        if (n.ref.postId) data['postId'] = n.ref.postId;
        if (n.ref.projectId) data['projectId'] = n.ref.projectId;
      }
      const { invalidTokens } = await this.sender.send(tokens, {
        title: n.title,
        body: n.body,
        data,
        channelId: channelFor(n.type),
        ...(collapseKey ? { collapseKey } : {}),
      });
      await this.devices.removeTokens(invalidTokens);
    } catch (err) {
      logger.error({ err: String(err), notificationId: n.id }, 'push fan-out failed');
    }
  }
}
