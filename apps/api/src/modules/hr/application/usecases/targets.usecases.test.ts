import { describe, expect, it } from 'vitest';
import type { SalesTarget } from '../../domain/hr.entity.js';
import type { SalesTargetRepositoryPort } from '../../domain/ports.js';
import { ID, as, world } from '../testing/fakes.js';
import { GetTargetsUseCase, SetTargetUseCase } from './targets.usecases.js';

class FakeTargets implements SalesTargetRepositoryPort {
  rows: SalesTarget[] = [];
  async set(month: string, userId: string, amount: number, byId: string, at: Date) {
    this.rows = this.rows.filter((r) => !(r.month === month && r.userId === userId));
    const row = { month, userId, amount, setById: byId, setAt: at };
    this.rows.push(row);
    return row;
  }
  async forMonth(month: string) {
    return this.rows.filter((r) => r.month === month);
  }
  async upToMonth(month: string) {
    return this.rows.filter((r) => r.month <= month);
  }
}

describe('monthly sales targets', () => {
  it('carries the latest earlier month forward until a new one is set', async () => {
    const w = world();
    const repo = new FakeTargets();
    const set = new SetTargetUseCase(w.directory, repo, w.clock);
    await set.execute(ID.admin, '2026-09', ID.gps, { amount: 300_000 });
    await set.execute(ID.admin, '2026-10', ID.gps, { amount: 500_000 });
    const get = new GetTargetsUseCase(repo);

    expect((await get.execute('2026-10')).rows).toEqual([
      { userId: ID.gps, amount: 500_000, carriedFrom: null },
    ]);
    expect((await get.execute('2026-11')).rows).toEqual([
      { userId: ID.gps, amount: 500_000, carriedFrom: '2026-10' },
    ]);
    expect((await get.execute('2026-09')).rows[0]?.amount).toBe(300_000);
    expect((await get.execute('2026-08')).rows).toEqual([]); // nothing before it was ever set
  });

  it('a target of 0 is real: it stops the carry-forward', async () => {
    const w = world();
    const repo = new FakeTargets();
    const set = new SetTargetUseCase(w.directory, repo, w.clock);
    await set.execute(ID.admin, '2026-10', ID.gps, { amount: 500_000 });
    await set.execute(ID.admin, '2026-11', ID.gps, { amount: 0 });
    expect((await new GetTargetsUseCase(repo).execute('2026-12')).rows[0]).toEqual({
      userId: ID.gps,
      amount: 0,
      carriedFrom: '2026-11',
    });
  });

  it('refuses someone who is not on staff', async () => {
    const w = world();
    const set = new SetTargetUseCase(w.directory, new FakeTargets(), w.clock);
    await expect(set.execute(as('x').id, '2026-11', 'nobody', { amount: 1 })).rejects.toThrow(
      /No such employee/,
    );
  });
});
