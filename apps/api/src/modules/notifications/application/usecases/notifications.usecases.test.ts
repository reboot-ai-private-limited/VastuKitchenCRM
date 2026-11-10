import { describe, expect, it } from 'vitest';
import type {
  NewNotification,
  Notification,
  NotificationListFilter,
} from '../../domain/notification.entity.js';
import type { NotificationRepositoryPort } from '../../domain/notification.repository.port.js';
import {
  CountUnreadUseCase,
  ListNotificationsUseCase,
  MarkAllReadUseCase,
  MarkReadUseCase,
  NotifyUseCase,
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
