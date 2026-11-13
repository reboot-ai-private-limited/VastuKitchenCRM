import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from '@/shared/logging/logger.js';
import type { PushMessage, PushResult, PushSenderPort } from '../domain/pushSender.port.js';

/** FCM error codes that mean "this token will never work again". */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);
/** FCM multicast accepts at most 500 tokens per call. */
const BATCH = 500;

export class FcmPushSender implements PushSenderPort {
  private readonly app: App;

  /** `serviceAccountJson` is the Firebase service-account file, raw JSON or base64 of it. */
  constructor(serviceAccountJson: string) {
    const text = serviceAccountJson.trim().startsWith('{')
      ? serviceAccountJson
      : Buffer.from(serviceAccountJson, 'base64').toString('utf8');
    this.app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(text)) });
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult> {
    const invalidTokens: string[] = [];
    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const res = await getMessaging(this.app).sendEachForMulticast({
        tokens: batch,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
          priority: 'high',
          ...(message.collapseKey ? { collapseKey: message.collapseKey } : {}),
          notification: {
            channelId: message.channelId,
            ...(message.collapseKey ? { tag: message.collapseKey } : {}),
          },
        },
      });
      res.responses.forEach((r, idx) => {
        const token = batch[idx];
        if (r.success || token === undefined) return;
        const code = r.error?.code ?? '';
        if (DEAD_TOKEN_CODES.has(code)) invalidTokens.push(token);
        else logger.warn({ code }, 'fcm send failed');
      });
    }
    return { invalidTokens };
  }
}

/** Used when push is not configured (dev, tests): sends nothing, says so once per call at debug. */
export class NoopPushSender implements PushSenderPort {
  send(tokens: string[], message: PushMessage): Promise<PushResult> {
    logger.debug({ tokens: tokens.length, title: message.title }, 'push disabled; not sent');
    return Promise.resolve({ invalidTokens: [] });
  }
}
