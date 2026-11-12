import { describe, expect, it } from 'vitest';
import { createEventBus } from '@/shared/events/appEvents.js';
import type {
  DeletionRequest,
  DeletionRequestRepositoryPort,
  NewDeletionRequest,
} from '../../domain/deletionRequest.repository.port.js';
import { FakeSessions, FakeUsers, addUser } from '../testing/fakes.js';
import { RequestAccountDeletionUseCase } from './requestAccountDeletion.usecase.js';

class FakeRequests implements DeletionRequestRepositoryPort {
  rows: DeletionRequest[] = [];
  async create(i: NewDeletionRequest) {
    const row = { ...i, id: `r${this.rows.length + 1}`, completedAt: null };
    this.rows.push(row);
    return row;
  }
}

function setup() {
  const users = new FakeUsers();
  const sessions = new FakeSessions();
  const requests = new FakeRequests();
  const events = createEventBus();
  const seen: string[] = [];
  events.on('user.deactivated', () => void seen.push('user.deactivated'));
  events.on('account.deletion-requested', () => void seen.push('account.deletion-requested'));
  const useCase = new RequestAccountDeletionUseCase(
    users,
    sessions,
    requests,
    events,
    () => new Date('2026-11-12T10:00:00Z'),
  );
  const settle = () => new Promise((r) => setTimeout(r, 5));
  return { users, sessions, requests, seen, useCase, settle };
}

describe('RequestAccountDeletionUseCase', () => {
  it('records the request, deactivates, revokes sessions and announces it', async () => {
    const { users, sessions, requests, seen, useCase, settle } = setup();
    const sales = await addUser(users, { role: 'SALES', name: 'Asha', phone: '9876500001' });
    await sessions.create({
      userId: sales.id,
      tokenHash: 'h',
      client: 'mobile',
      expiresAt: new Date('2027-01-01'),
    } as never);

    await useCase.execute(sales.id, '  not using it  ');
    await settle();

    expect(requests.rows).toEqual([
      expect.objectContaining({
        userId: sales.id,
        name: 'Asha',
        phone: '9876500001',
        reason: 'not using it',
        requestedAt: new Date('2026-11-12T10:00:00Z'),
      }),
    ]);
    expect((await users.findById(sales.id))?.active).toBe(false);
    expect(sessions.rows.every((s) => s.revokedAt !== null)).toBe(true);
    expect([...seen].sort()).toEqual(['account.deletion-requested', 'user.deactivated']);
  });

  it('is harmless to ask twice', async () => {
    const { users, requests, useCase } = setup();
    const c = await addUser(users, { role: 'CUSTOMER' });
    await useCase.execute(c.id);
    await useCase.execute(c.id);
    expect(requests.rows).toHaveLength(1);
  });

  it('will not remove the only active Admin', async () => {
    const { users, requests, useCase } = setup();
    const admin = await addUser(users, { role: 'ADMIN' });
    await expect(useCase.execute(admin.id)).rejects.toMatchObject({ statusCode: 409 });
    expect((await users.findById(admin.id))?.active).toBe(true);
    expect(requests.rows).toHaveLength(0);
    await addUser(users, { role: 'ADMIN', phone: '9876500002' });
    await expect(useCase.execute(admin.id)).resolves.toBeUndefined();
  });

  it('rejects an unknown caller', async () => {
    const { useCase } = setup();
    await expect(useCase.execute('nobody')).rejects.toMatchObject({ statusCode: 401 });
  });
});
