import { describe, expect, it } from 'vitest';
import type { Device, UpsertDevice } from '../../domain/device.entity.js';
import type { DeviceRepositoryPort } from '../../domain/device.repository.port.js';
import type { NewNotification, Notification } from '../../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../../domain/notification.repository.port.js';
import type { PushMessage, PushSenderPort } from '../../domain/pushSender.port.js';
import { PushFanout } from '../services/pushFanout.js';
import { RegisterDeviceUseCase, RemoveDeviceUseCase } from './devices.usecases.js';
import { NotifyUseCase } from './notifications.usecases.js';

class FakeNotifications implements NotificationRepositoryPort {
  keys = new Set<string>();
  async createIfNew(n: NewNotification): Promise<Notification | null> {
    const key = n.dedupeKey ? `${n.userId}:${n.dedupeKey}` : null;
    if (key && this.keys.has(key)) return null;
    if (key) this.keys.add(key);
    return { ...n, id: 'n1', readAt: null, createdAt: new Date() };
  }
  list = async () => ({ items: [], total: 0 });
  countUnread = async () => 0;
  markRead = async () => true;
  markAllRead = async () => 0;
}

class FakeDevices implements DeviceRepositoryPort {
  rows: Device[] = [];
  async upsertByToken(d: UpsertDevice): Promise<Device> {
    this.rows = this.rows.filter((r) => r.token !== d.token);
    const row = { ...d, id: `d${this.rows.length + 1}`, createdAt: new Date() };
    this.rows.push(row);
    return row;
  }
  async removeOwn(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.id === id && r.userId === userId));
    return this.rows.length < before;
  }
  async listFcmTokens(userId: string) {
    return this.rows.filter((r) => r.userId === userId && r.provider === 'fcm').map((r) => r.token);
  }
  async removeTokens(tokens: string[]) {
    this.rows = this.rows.filter((r) => !tokens.includes(r.token));
  }
  async removeAllForUser(userId: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.userId !== userId);
    return before - this.rows.length;
  }
}

class FakeSender implements PushSenderPort {
  sent: { tokens: string[]; message: PushMessage }[] = [];
  dead: string[] = [];
  fail = false;
  async send(tokens: string[], message: PushMessage) {
    if (this.fail) throw new Error('fcm down');
    this.sent.push({ tokens, message });
    return { invalidTokens: tokens.filter((t) => this.dead.includes(t)) };
  }
}

const input = (over: Partial<NewNotification> = {}): NewNotification => ({
  userId: 'u1',
  type: 'LEAD_CREATED',
  title: 'New lead',
  body: 'Asha',
  ref: { kind: 'LEAD', id: 'l1' },
  dedupeKey: null,
  ...over,
});

function setup() {
  const devices = new FakeDevices();
  const sender = new FakeSender();
  const notify = new NotifyUseCase(new FakeNotifications(), new PushFanout(devices, sender));
  const register = new RegisterDeviceUseCase(devices);
  return { devices, sender, notify, register };
}

describe('push on notify', () => {
  it('sends to the FCM tokens of the recipient with deep-link data', async () => {
    const { sender, notify, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    await register.execute('u2', { platform: 'android', pushToken: 'fcm-token-bbbb', provider: 'fcm' });
    await notify.execute(input());
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.tokens).toEqual(['fcm-token-aaaa']);
    expect(sender.sent[0]!.message.data).toMatchObject({ type: 'LEAD_CREATED', refKind: 'LEAD', refId: 'l1' });
    expect(sender.sent[0]!.message.channelId).toBe('sales');
  });

  it('does not push a deduped notification twice', async () => {
    const { sender, notify, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    await notify.execute(input({ dedupeKey: 'k' }));
    const second = await notify.execute(input({ dedupeKey: 'k' }));
    expect(second.created).toBe(false);
    expect(sender.sent).toHaveLength(1);
  });

  it('ignores Expo tokens and users without devices', async () => {
    const { sender, notify, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'ExponentPushToken[abcdef]' });
    expect((await notify.execute(input())).created).toBe(true);
    expect(sender.sent).toHaveLength(0);
  });

  it('collapses recurring reminders by type', async () => {
    const { sender, notify, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    await notify.execute(input({ type: 'LEAD_STAGNANT' }));
    await notify.execute(input({ type: 'LEAD_ASSIGNED' }));
    expect(sender.sent[0]!.message.collapseKey).toBe('LEAD_STAGNANT');
    expect(sender.sent[1]!.message.collapseKey).toBeUndefined();
  });

  it('prunes tokens FCM reports dead', async () => {
    const { devices, sender, notify, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    sender.dead = ['fcm-token-aaaa'];
    await notify.execute(input());
    expect(devices.rows).toHaveLength(0);
  });

  it('never fails the notification when FCM is down', async () => {
    const { sender, notify, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    sender.fail = true;
    await expect(notify.execute(input())).resolves.toEqual({ created: true });
  });
});

describe('devices', () => {
  it('moves a token to the new user and removes only your own device', async () => {
    const { devices, register } = setup();
    await register.execute('u1', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    const moved = await register.execute('u2', { platform: 'android', pushToken: 'fcm-token-aaaa', provider: 'fcm' });
    expect(devices.rows).toHaveLength(1);
    const remove = new RemoveDeviceUseCase(devices);
    await expect(remove.execute('u1', moved.id)).rejects.toThrow();
    await expect(remove.execute('u2', moved.id)).resolves.toBeUndefined();
  });
});
