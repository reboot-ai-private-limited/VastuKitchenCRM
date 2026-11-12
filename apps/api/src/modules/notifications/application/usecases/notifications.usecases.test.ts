import { describe, expect, it } from 'vitest';
import type {
  NewNotification,
  Notification,
  NotificationListFilter,
} from '../../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../../domain/notification.repository.port.js';
import type { DeviceRepositoryPort } from '../../domain/device.repository.port.js';
import type { PushMessage, PushSenderPort } from '../../domain/pushSender.port.js';
import {
  CountUnreadUseCase,
  ListNotificationsUseCase,
  MarkAllReadUseCase,
  MarkReadUseCase,
  NotifyUseCase,
  RemoveDeviceUseCase,
  RemoveUserDevicesUseCase,
} from './notifications.usecases.js';

/** In-memory repository with the same contract as the Mongo one (incl. the dedupe rule). */
class FakeRepo implements NotificationRepositoryPort {
  rows: Notification[] = [];
  async createIfNew(n: NewNotification) {
    if (n.dedupeKey && this.rows.some((r) => r.userId === n.userId && r.dedupeKey === n.dedupeKey))
      return null;
    const created: Notification = {
      ...n,
      id: `n${this.rows.length + 1}`,
      readAt: null,
      createdAt: new Date(),
    };
    this.rows.unshift(created);
    return created;
  }
  async list(userId: string, f: NotificationListFilter) {
    const items = this.rows.filter(
      (r) => r.userId === userId && (!f.unreadOnly || r.readAt === null),
    );
    return { items, total: items.length };
  }
  async countUnread(userId: string) {
    return this.rows.filter((r) => r.userId === userId && r.readAt === null).length;
  }
  async markRead(userId: string, id: string, at: Date) {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    if (!row) return false;
    row.readAt = at;
    return true;
  }
  async markAllRead(userId: string, at: Date) {
    const mine = this.rows.filter((r) => r.userId === userId && r.readAt === null);
    mine.forEach((r) => (r.readAt = at));
    return mine.length;
  }
}

const note = (over: Partial<NewNotification> = {}): NewNotification => ({
  userId: 'u1',
  type: 'PROPOSAL_SEEN',
  title: 'Proposal seen',
  body: 'Mrs Rao opened it',
  ref: { kind: 'PROPOSAL', id: 'p1' },
  dedupeKey: null,
  ...over,
});

describe('notifications', () => {
  it('delivers a keyed alert once per person, but to each person once', async () => {
    const repo = new FakeRepo();
    const notify = new NotifyUseCase(repo);
    expect(await notify.execute(note({ dedupeKey: 'k' }))).toEqual({ created: true });
    expect(await notify.execute(note({ dedupeKey: 'k' }))).toEqual({ created: false });
    expect(await notify.execute(note({ userId: 'u2', dedupeKey: 'k' }))).toEqual({ created: true });
    // No key: always delivered (e.g. every re-assignment is news).
    await notify.execute(note());
    await notify.execute(note());
    expect(repo.rows).toHaveLength(4);
  });

  it("counts, lists and marks only the caller's own", async () => {
    const repo = new FakeRepo();
    const notify = new NotifyUseCase(repo);
    await notify.execute(note({ userId: 'u1' }));
    await notify.execute(note({ userId: 'u1' }));
    await notify.execute(note({ userId: 'u2' }));

    expect(await new CountUnreadUseCase(repo).execute('u1')).toBe(2);
    const first = repo.rows.find((r) => r.userId === 'u1')!;
    await new MarkReadUseCase(repo).execute('u1', first.id);
    expect(await new CountUnreadUseCase(repo).execute('u1')).toBe(1);
    expect(
      (
        await new ListNotificationsUseCase(repo).execute('u1', {
          page: 1,
          pageSize: 20,
          unread: true,
        })
      ).items,
    ).toHaveLength(1);

    // Someone else's notification looks like it does not exist.
    const theirs = repo.rows.find((r) => r.userId === 'u2')!;
    await expect(new MarkReadUseCase(repo).execute('u1', theirs.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(await new MarkAllReadUseCase(repo).execute('u1')).toBe(1);
    expect(await new CountUnreadUseCase(repo).execute('u2')).toBe(1);
  });
});

class FakeDevices implements DeviceRepositoryPort {
  tokens = new Map<string, string[]>();
  async register() {
    return {} as never;
  }
  async remove(userId: string, id: string) {
    const mine = this.tokens.get(userId) ?? [];
    if (!mine.includes(id)) return false;
    this.tokens.set(
      userId,
      mine.filter((t) => t !== id),
    );
    return true;
  }
  async removeAllFor(userId: string) {
    const n = (this.tokens.get(userId) ?? []).length;
    this.tokens.delete(userId);
    return n;
  }
  async tokensFor(userId: string) {
    return this.tokens.get(userId) ?? [];
  }
  async removeTokens(dead: string[]) {
    for (const [u, t] of this.tokens)
      this.tokens.set(
        u,
        t.filter((x) => !dead.includes(x)),
      );
  }
}

class FakeSender implements PushSenderPort {
  sent: Array<{ tokens: string[]; message: PushMessage }> = [];
  dead: string[] = [];
  fail = false;
  async send(tokens: string[], message: PushMessage) {
    if (this.fail) throw new Error('boom');
    this.sent.push({ tokens, message });
    return { deadTokens: this.dead };
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('push', () => {
  const setup = () => {
    const repo = new FakeRepo();
    const devices = new FakeDevices();
    devices.tokens.set('u1', ['tok1', 'tok2']);
    const sender = new FakeSender();
    const notify = new NotifyUseCase(repo, { devices, sender, now: () => new Date(1_000) });
    return { repo, devices, sender, notify };
  };

  it('pushes only a newly created row, with ids in the data', async () => {
    const { sender, notify } = setup();
    await notify.execute(note({ dedupeKey: 'k', type: 'LEAD_ASSIGNED' }));
    await notify.execute(note({ dedupeKey: 'k', type: 'LEAD_ASSIGNED' }));
    await flush();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]!.tokens).toEqual(['tok1', 'tok2']);
    expect(sender.sent[0]!.message.priority).toBe('high');
    expect(sender.sent[0]!.message.data).toMatchObject({ notificationId: 'n1', ref: { id: 'p1' } });
  });

  it('never fails the business action when the push fails', async () => {
    const { sender, repo, notify } = setup();
    sender.fail = true;
    await expect(notify.execute(note())).resolves.toEqual({ created: true });
    await flush();
    expect(repo.rows).toHaveLength(1);
  });

  it('forgets tokens reported as DeviceNotRegistered', async () => {
    const { sender, devices, notify } = setup();
    sender.dead = ['tok2'];
    await notify.execute(note());
    await flush();
    expect(devices.tokens.get('u1')).toEqual(['tok1']);
  });

  it('does not push to a user with no devices', async () => {
    const { sender, notify } = setup();
    await notify.execute(note({ userId: 'u2' }));
    await flush();
    expect(sender.sent).toHaveLength(0);
  });

  it('folds a burst of the same type into one summary push', async () => {
    const { sender, repo, notify } = setup();
    for (let i = 0; i < 8; i++) await notify.execute(note({ type: 'LEAD_STAGNANT' }));
    await flush();
    expect(repo.rows).toHaveLength(8);
    // 3 singles + 1 summary; the rest are suppressed.
    expect(sender.sent).toHaveLength(4);
    expect(sender.sent[3]!.message.title).toBe('Several updates');
  });
});

describe('devices', () => {
  it("removes only the caller's own device", async () => {
    const devices = new FakeDevices();
    devices.tokens.set('u1', ['d1']);
    await expect(new RemoveDeviceUseCase(devices).execute('u2', 'd1')).rejects.toMatchObject({
      statusCode: 404,
    });
    await new RemoveDeviceUseCase(devices).execute('u1', 'd1');
    expect(devices.tokens.get('u1')).toEqual([]);
  });
  it("drops every device of a deactivated user, and nobody else's", async () => {
    const devices = new FakeDevices();
    devices.tokens.set('u1', ['d1', 'd2']);
    devices.tokens.set('u2', ['d3']);
    expect(await new RemoveUserDevicesUseCase(devices).execute('u1')).toBe(2);
    expect(devices.tokens.get('u1')).toBeUndefined();
    expect(devices.tokens.get('u2')).toEqual(['d3']);
  });
});
