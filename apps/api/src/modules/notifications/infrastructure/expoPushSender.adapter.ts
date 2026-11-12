import { logger } from '@/shared/logging/logger.js';
import type { PushMessage, PushSenderPort } from '../domain/pushSender.port.js';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts up to 100 messages per request. */
const BATCH = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * Expo Push Service. A ticket error of `DeviceNotRegistered` means the token is dead for good, so
 * it is reported back and forgotten. (Delayed receipts are not polled: the same error shows up on
 * the next send's ticket, which is enough to prune.) Never throws; a failed push is logged.
 */
export class ExpoPushSender implements PushSenderPort {
  constructor(
    private readonly accessToken?: string,
    private readonly http: typeof fetch = fetch,
  ) {}

  async send(tokens: string[], m: PushMessage): Promise<{ deadTokens: string[] }> {
    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const chunk = tokens.slice(i, i + BATCH);
      try {
        const res = await this.http(EXPO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(
            chunk.map((to) => ({
              to,
              title: m.title,
              body: m.body,
              data: m.data,
              priority: m.priority,
              sound: 'default',
              channelId: 'default',
            })),
          ),
        });
        if (!res.ok) {
          logger.warn({ status: res.status }, 'Expo push service refused a batch');
          continue;
        }
        const json = (await res.json()) as { data?: ExpoTicket[] };
        (json.data ?? []).forEach((t, idx) => {
          if (t.status !== 'error') return;
          if (t.details?.error === 'DeviceNotRegistered') {
            const token = chunk[idx];
            if (token) dead.push(token);
          } else {
            logger.warn({ error: t.details?.error, message: t.message }, 'Expo push ticket error');
          }
        });
      } catch (err) {
        logger.warn({ err }, 'Expo push service unreachable');
      }
    }
    return { deadTokens: dead };
  }
}
