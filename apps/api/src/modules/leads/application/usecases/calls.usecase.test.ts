import { describe, expect, it } from 'vitest';
import { GetCallStatsUseCase, RecordCallUseCase } from './calls.usecase.js';
import { addLead, sales1, sales2, world } from '../testing/fakes.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const call = (over = {}) => ({
  startedAt: new Date('2026-11-10T09:00:00Z'),
  durationSec: 120,
  answered: true,
  ...over,
});

function setup() {
  const w = world(() => NOW);
  return {
    w,
    record: new RecordCallUseCase(w.access, w.calls, w.leads, w.activities, w.directory, () => NOW),
  };
}

describe('RecordCallUseCase', () => {
  it('is idempotent: a retried upload is not counted twice', async () => {
    const { w, record } = setup();
    const lead = await addLead(w);
    const first = await record.execute(sales1, lead.id, call());
    const retry = await record.execute(sales1, lead.id, call());
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(w.calls.rows).toHaveLength(1);
    expect(w.activities.types(lead.id).filter((t) => t === 'CALL')).toHaveLength(1);
  });

  it('moves a NEW lead to CONTACTED on the first call only', async () => {
    const { w, record } = setup();
    const lead = await addLead(w, { status: 'NEW' });
    await record.execute(sales1, lead.id, call());
    expect(w.leads.rows[0]?.status).toBe('CONTACTED');

    const later = await addLead(w, { phone: '9876500002', status: 'FOLLOW_UP' });
    await record.execute(sales1, later.id, call());
    expect(w.leads.rows[1]?.status).toBe('FOLLOW_UP');
  });

  it('refuses calls on a lead the user cannot access', async () => {
    const { w, record } = setup();
    const lead = await addLead(w, { assignedToId: 'sales1' });
    await expect(record.execute(sales2, lead.id, call())).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(w.calls.rows).toHaveLength(0);
  });

  it('refuses a start time in the future but tolerates small clock skew', async () => {
    const { w, record } = setup();
    const lead = await addLead(w);
    await expect(
      record.execute(sales1, lead.id, call({ startedAt: new Date('2026-11-10T13:00:00Z') })),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      record.execute(sales1, lead.id, call({ startedAt: new Date('2026-11-10T12:03:00Z') })),
    ).resolves.toBeDefined();
  });
});

describe('GetCallStatsUseCase', () => {
  it('sums calls, answered and talk time per employee for the window', async () => {
    const { w, record } = setup();
    const a = await addLead(w, { assignedToId: 'sales1' });
    const b = await addLead(w, { phone: '9876500002', assignedToId: 'sales2' });
    await record.execute(
      sales1,
      a.id,
      call({ startedAt: new Date('2026-11-10T09:00:00Z'), durationSec: 60 }),
    );
    await record.execute(
      sales1,
      a.id,
      call({ startedAt: new Date('2026-11-10T10:00:00Z'), durationSec: 0, answered: false }),
    );
    await record.execute(
      sales2,
      b.id,
      call({ startedAt: new Date('2026-11-10T09:30:00Z'), durationSec: 300 }),
    );
    await record.execute(
      sales2,
      b.id,
      call({ startedAt: new Date('2026-11-09T09:30:00Z'), durationSec: 999 }),
    ); // yesterday

    const stats = await new GetCallStatsUseCase(w.calls, w.directory, () => NOW).execute({
      from: new Date('2026-11-10T00:00:00Z'),
      to: new Date('2026-11-11T00:00:00Z'),
    });
    expect(
      stats.map((s) => [s.userName, s.stat.calls, s.stat.answered, s.stat.talkSeconds]),
    ).toEqual([
      ['Ravi', 2, 1, 60],
      ['Asha', 1, 1, 300],
    ]);
  });
});
