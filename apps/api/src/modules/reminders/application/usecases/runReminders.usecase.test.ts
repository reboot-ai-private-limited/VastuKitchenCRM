import { describe, expect, it } from 'vitest';
import { RunRemindersUseCase } from './runReminders.usecase.js';
import {
  CONFIG,
  FakeAdmins,
  FakeLeadSource,
  FakeNotifier,
  FakeProposalSource,
  T0,
  at,
  lead,
  proposal,
} from '../testing/fakes.js';

function setup(config = CONFIG) {
  let now = T0;
  const proposals = new FakeProposalSource();
  const leads = new FakeLeadSource();
  const notifier = new FakeNotifier();
  const admins = new FakeAdmins();
  const run = new RunRemindersUseCase(
    proposals,
    leads,
    notifier,
    admins,
    async () => config,
    () => now,
  );
  return {
    proposals,
    leads,
    notifier,
    admins,
    run: (when: Date) => {
      now = when;
      return run.execute();
    },
  };
}

describe('rule 1 — proposal never opened', () => {
  it('alerts the assignee after the threshold, once, however often the job runs', async () => {
    const w = setup();
    w.proposals.rows.push(proposal());
    w.leads.rows.push(lead());

    expect((await w.run(at(1))).unseen).toBe(0); // 1 day: too early
    expect((await w.run(at(3))).unseen).toBe(1); // 3 days: alert
    expect((await w.run(at(3.5))).unseen).toBe(0); // job runs again: nothing new
    expect((await w.run(at(9))).unseen).toBe(0);

    expect(w.notifier.delivered).toHaveLength(1);
    expect(w.notifier.delivered[0]).toMatchObject({
      userId: 'sales1',
      type: 'PROPOSAL_UNSEEN',
      ref: { kind: 'PROPOSAL', id: 'p1' },
      dedupeKey: 'proposal-unseen:p1',
    });
    expect(w.notifier.delivered[0]?.body).toContain('has not opened proposal VK-2026-0001');
  });

  it('stays quiet for a Won/Lost lead and for a lead that no longer exists', async () => {
    const w = setup();
    w.proposals.rows.push(
      proposal({ id: 'a', leadId: 'won' }),
      proposal({ id: 'b', leadId: 'gone' }),
    );
    w.leads.rows.push(lead({ id: 'won', status: 'WON' }));
    expect((await w.run(at(3))).unseen).toBe(0);
  });

  it('ignores proposals older than the look-back window', async () => {
    const w = setup();
    w.proposals.rows.push(proposal());
    w.leads.rows.push(lead());
    expect((await w.run(at(40))).unseen).toBe(0);
  });

  it('falls back to the sender, then to every active Admin', async () => {
    const w = setup();
    w.proposals.rows.push(
      proposal({ id: 'a', leadId: 'l-unassigned', sentById: 'sales2' }),
      proposal({ id: 'b', leadId: 'l-nobody', sentById: null }),
    );
    w.leads.rows.push(
      lead({ id: 'l-unassigned', assignedToId: null }),
      lead({ id: 'l-nobody', assignedToId: null }),
    );
    expect((await w.run(at(3))).unseen).toBe(3); // sales2 + admin1 + admin2
    expect(w.notifier.to('sales2')).toHaveLength(1);
    expect(w.notifier.to('admin1')).toHaveLength(1);
    expect(w.notifier.to('admin2')).toHaveLength(1);
  });

  it('does not look up Admins when there is an assignee', async () => {
    const w = setup();
    w.proposals.rows.push(proposal());
    w.leads.rows.push(lead());
    await w.run(at(3));
    expect(w.admins.calls).toBe(0);
  });
});

describe('rule 2 — opened, but nothing happened', () => {
  it('alerts once when the status has not changed since the customer looked', async () => {
    const w = setup();
    w.proposals.rows.push(proposal({ firstSeenAt: at(0.5) }));
    w.leads.rows.push(lead({ statusChangedAt: T0 }));

    expect((await w.run(at(2))).noAction).toBe(0); // opened only 1.5 days ago
    expect((await w.run(at(3))).noAction).toBe(1);
    expect((await w.run(at(4))).noAction).toBe(0);
    expect(w.notifier.delivered[0]).toMatchObject({
      type: 'PROPOSAL_NO_ACTION',
      dedupeKey: 'proposal-no-action:p1',
    });
    expect(w.notifier.delivered[0]?.body).toContain('still in Proposal Sent');
  });

  it('stays quiet when someone already moved the lead after the customer opened it', async () => {
    const w = setup();
    w.proposals.rows.push(proposal({ firstSeenAt: at(0.5) }));
    w.leads.rows.push(lead({ status: 'FOLLOW_UP', statusChangedAt: at(1) }));
    expect((await w.run(at(5))).noAction).toBe(0);
  });

  it('stays quiet for a closed lead', async () => {
    const w = setup();
    w.proposals.rows.push(proposal({ firstSeenAt: at(0.5) }));
    w.leads.rows.push(lead({ status: 'LOST' }));
    expect((await w.run(at(5))).noAction).toBe(0);
  });
});

describe('rule 3 — stagnant lead', () => {
  const contacted = (over = {}) => lead({ status: 'CONTACTED', ...over });

  it('repeats every window up to the maximum, then stops', async () => {
    const w = setup(); // stuckDays 2, max 3
    w.leads.rows.push(contacted());

    expect((await w.run(at(1))).stagnant).toBe(0); //  1d: not stuck yet
    expect((await w.run(at(2.5))).stagnant).toBe(1); // window 1
    expect((await w.run(at(3))).stagnant).toBe(0); //   same window: no repeat
    expect((await w.run(at(4.5))).stagnant).toBe(1); // window 2
    expect((await w.run(at(6.5))).stagnant).toBe(1); // window 3
    expect((await w.run(at(8.5))).stagnant).toBe(0); // window 4 > max: stops
    expect((await w.run(at(30))).stagnant).toBe(0);

    expect(w.notifier.delivered).toHaveLength(3);
    expect(w.notifier.delivered.map((d) => d.dedupeKey.split(':').pop())).toEqual(['1', '2', '3']);
  });

  it('skips PROPOSAL_SENT (rules 1 and 2 cover those) and finished leads', async () => {
    const w = setup();
    w.leads.rows.push(
      lead({ id: 'a', status: 'PROPOSAL_SENT' }),
      lead({ id: 'b', status: 'WON' }),
      lead({ id: 'c', status: 'LOST' }),
    );
    expect((await w.run(at(3))).stagnant).toBe(0);
  });

  it('starts a fresh series when the status changes, so it can alert again', async () => {
    const w = setup();
    w.leads.rows.push(contacted());
    await w.run(at(2.5));
    expect(w.notifier.delivered).toHaveLength(1);

    // Someone moves the lead on (a new statusChangedAt), and it then sits still again.
    w.leads.rows[0] = lead({ status: 'VISIT', statusChangedAt: at(3) });
    await w.run(at(5.5));
    expect(w.notifier.delivered).toHaveLength(2);
    expect(w.notifier.delivered[1]?.body).toContain('in Visit');
  });

  it('alerts Admins when an old lead was never assigned', async () => {
    const w = setup();
    w.leads.rows.push(contacted({ assignedToId: null }));
    expect((await w.run(at(2.5))).stagnant).toBe(2);
    expect(w.notifier.to('admin1')[0]).toMatchObject({
      type: 'LEAD_STAGNANT',
      ref: { kind: 'LEAD', id: 'lead1' },
    });
  });

  it('uses the configured values, so demos can shrink the days to minutes', async () => {
    const w = setup({ unseenDays: 0.001, noActionDays: 0.001, stuckDays: 0.001, stagnantMax: 3 });
    w.leads.rows.push(contacted());
    w.proposals.rows.push(proposal());
    w.leads.rows.push(lead({ id: 'lead1' }));
    const result = await w.run(new Date(T0.getTime() + 2 * 60_000)); // two minutes later
    expect(result.stagnant).toBe(1);
    expect(result.unseen).toBe(1);
  });
});
