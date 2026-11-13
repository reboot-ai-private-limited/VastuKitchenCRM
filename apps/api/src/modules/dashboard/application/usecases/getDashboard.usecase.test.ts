import { describe, expect, it } from 'vitest';
import { ADMIN, DAY, HR, NOW, at, staff, world } from '../testing/fakes.js';

describe('the range', () => {
  it('defaults to today and turns business dates into real instants (Siliguri is UTC+5:30)', async () => {
    const w = world();
    const d = await w.run.execute(ADMIN, {});
    expect(d.range).toEqual({ from: '2026-11-11', to: '2026-11-11' });
    const [from, to] = w.calls['dashboardCounts']![0] as [Date, Date];
    expect(from.toISOString()).toBe('2026-11-10T18:30:00.000Z'); // 00:00 on the 11th
    expect(to.toISOString()).toBe('2026-11-11T18:30:00.000Z'); // 00:00 on the 12th
    expect(w.calls['dayCounts']![0]).toEqual(['2026-11-11']);
  });

  it('one given date is a one-day range; a span is inclusive', async () => {
    const w = world();
    expect((await w.run.execute(ADMIN, { to: '2026-11-05' })).range).toEqual({
      from: '2026-11-05',
      to: '2026-11-05',
    });
    const span = await w.run.execute(ADMIN, { from: '2026-11-01', to: '2026-11-07' });
    expect(span.range).toEqual({ from: '2026-11-01', to: '2026-11-07' });
    const [, to] = w.calls['dashboardCounts']!.at(-1) as [Date, Date];
    expect(to.toISOString()).toBe('2026-11-07T18:30:00.000Z');
  });

  it('refuses a backwards range and more than 31 days', async () => {
    const w = world();
    await expect(
      w.run.execute(ADMIN, { from: '2026-11-10', to: '2026-11-09' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      w.run.execute(ADMIN, { from: '2026-10-01', to: '2026-11-01' }),
    ).rejects.toMatchObject({ statusCode: 400 }); // 32 days
    await expect(
      w.run.execute(ADMIN, { from: '2026-10-01', to: '2026-10-31' }),
    ).resolves.toBeTruthy(); // 31 days
  });
});

describe('counters', () => {
  it('counts open leads, running projects, pending complaints', async () => {
    const w = world();
    Object.assign(w.data.leadByStatus, {
      NEW: 4,
      CONTACTED: 3,
      VISIT: 1,
      PROPOSAL_SENT: 2,
      FOLLOW_UP: 5,
      WON: 9,
      LOST: 6,
    });
    w.data.leadsCreated = 7;
    w.data.stages = { DESIGN: 3, SITE: 2, CLOSED: 10 };
    w.data.complaintCounts = { OPEN: 2, ASSIGNED: 1, RESOLVED: 3, CLOSED: 20 };
    const c = (await w.run.execute(ADMIN, {})).counters!;
    expect(c.leads).toMatchObject({ open: 15, newInRange: 7 }); // Won and Lost are not open
    expect(c.leads.byStatus.WON).toBe(9);
    expect(c.projects).toEqual({ design: 3, site: 2, running: 5 });
    expect(c.complaints).toMatchObject({ OPEN: 2, CLOSED: 20, pending: 6 }); // resolved but not closed is still pending
  });

  it('values the pipeline and the month’s wins by each lead’s latest sent proposal; no proposal = 0', async () => {
    const w = world();
    w.data.openLeadIds = ['l1', 'l2', 'l3'];
    w.data.wonLeadIds = ['l9', 'l8'];
    w.data.totals = [
      { leadId: 'l1', total: 400_000 },
      { leadId: 'l2', total: 250_000 },
      { leadId: 'l9', total: 1_200_000 },
    ];
    expect((await w.run.execute(ADMIN, {})).counters!.value).toEqual({
      pipeline: 650_000,
      wonInRange: 1_200_000,
      pipelineCapped: false,
    });
  });

  it('flags a pipeline too big to value in full', async () => {
    const w = world();
    w.data.openLeadIds = Array.from({ length: 2500 }, (_, i) => `l${i}`);
    const v = (await w.run.execute(ADMIN, {})).counters!.value;
    expect(v.pipelineCapped).toBe(true);
    expect(w.calls['openLeadIds']![0]).toEqual([2000]);
  });
});

describe('staff activity', () => {
  it('lists people on attendance plus anyone who did something, sorted, with merged first/last', async () => {
    const w = world();
    w.data.staff = [
      staff({ id: 'u2', name: 'Rita', attendanceType: 'BIOMETRIC' }),
      staff({ id: 'u1', name: 'Ravi', attendanceType: 'GPS' }),
      staff({ id: 'u3', name: 'Owner', role: 'ADMIN', attendanceType: null }), // not tracked, did nothing
      staff({ id: 'u4', name: 'Dev', role: 'DESIGNER', attendanceType: null }), // not tracked, but posted
      staff({ id: 'u5', name: 'Gita', attendanceType: 'GPS', active: false }), // gone, but did something
      staff({ id: 'u6', name: 'Zed', attendanceType: 'GPS', active: false }), // gone, did nothing
    ];
    w.data.leadActivity = [
      {
        userId: 'u1',
        actions: 12,
        leadsHandled: 5,
        firstAt: at('2026-11-11T04:00:00Z'),
        lastAt: at('2026-11-11T10:30:00Z'),
      },
    ];
    w.data.calls = [{ userId: 'u1', calls: 9, answered: 6, talkSeconds: 740 }];
    w.data.proposalActivity = [
      {
        userId: 'u1',
        generated: 2,
        sent: 1,
        firstAt: at('2026-11-11T03:50:00Z'),
        lastAt: at('2026-11-11T09:00:00Z'),
      },
    ];
    w.data.feedActivity = [
      {
        userId: 'u4',
        posts: 2,
        comments: 3,
        firstAt: at('2026-11-11T05:00:00Z'),
        lastAt: at('2026-11-11T06:00:00Z'),
      },
      {
        userId: 'u5',
        posts: 0,
        comments: 1,
        firstAt: at('2026-11-11T07:00:00Z'),
        lastAt: at('2026-11-11T07:00:00Z'),
      },
    ];
    w.data.attendance = [
      { userId: 'u1', daysPresent: 1, inAt: at('2026-11-11T03:35:00Z'), outAt: null },
    ];

    const people = (await w.run.execute(ADMIN, {})).people!;
    expect(people.map((p) => p.name)).toEqual(['Dev', 'Gita', 'Ravi', 'Rita']);
    const ravi = people.find((p) => p.name === 'Ravi')!;
    expect(ravi.attendance).toEqual({
      daysPresent: 1,
      inAt: '2026-11-11T03:35:00.000Z',
      outAt: null,
    });
    expect(ravi.activity).toEqual({
      firstAt: '2026-11-11T03:50:00.000Z', // the proposal came first
      lastAt: '2026-11-11T10:30:00.000Z',
      calls: 9,
      answeredCalls: 6,
      talkSeconds: 740,
      leadsHandled: 5,
      proposalsGenerated: 2,
      proposalsSent: 1,
      posts: 0,
      comments: 0,
    });
    const rita = people.find((p) => p.name === 'Rita')!;
    expect(rita.attendance).toEqual({ daysPresent: 0, inAt: null, outAt: null }); // tracked, nothing recorded
    expect(rita.activity).toMatchObject({ firstAt: null, lastAt: null, calls: 0, leadsHandled: 0 });
    expect(people.find((p) => p.name === 'Dev')?.attendance).toBeNull(); // not on attendance
  });
});

describe('what needs attention', () => {
  const sent = (id: string, leadId: string, daysAgo: number, seen: number | null = null) => ({
    id,
    number: `VK-${id}`,
    leadId,
    customerName: `Cust ${id}`,
    sentById: 'u1',
    sentAt: new Date(at(NOW).getTime() - daysAgo * DAY),
    firstSeenAt: seen === null ? null : new Date(at(NOW).getTime() - seen * DAY),
  });
  const lead = (
    id: string,
    status: 'NEW' | 'PROPOSAL_SENT' | 'WON' | 'FOLLOW_UP',
    daysAgo: number,
  ) => ({
    id,
    name: `Lead ${id}`,
    status,
    statusChangedAt: new Date(at(NOW).getTime() - daysAgo * DAY),
    assignedToId: 'u1',
  });

  it('unseen proposals: only for leads still open, with the age in words', async () => {
    const w = world();
    w.data.unseen = [sent('p1', 'l1', 5), sent('p2', 'l2', 4)];
    w.data.leadStates = [lead('l1', 'PROPOSAL_SENT', 5), lead('l2', 'WON', 1)];
    const block = (await w.run.execute(ADMIN, {})).attention!.unseenProposals;
    expect(block).toMatchObject({ total: 1, capped: false });
    expect(block.items[0]).toMatchObject({ title: 'Cust p1', ref: { kind: 'PROPOSAL', id: 'p1' } });
    expect(block.items[0]!.detail).toBe('Proposal VK-p1 sent 5 days ago, not opened yet');
  });

  it('seen but no action: not when the status changed after the customer looked', async () => {
    const w = world();
    w.data.seenProposals = [sent('p1', 'l1', 6, 3), sent('p2', 'l2', 6, 3)];
    w.data.leadStates = [lead('l1', 'FOLLOW_UP', 4), lead('l2', 'FOLLOW_UP', 1)]; // l2 moved 1 day ago, after the open
    const block = (await w.run.execute(ADMIN, {})).attention!.noActionProposals;
    expect(block.items.map((i) => i.title)).toEqual(['Cust p1']);
    expect(block.items[0]!.detail).toBe(
      'Opened proposal VK-p1 3 days ago, lead is still Follow-up',
    );
  });

  it('stagnant leads skip Proposal Sent (the proposal blocks cover those) and use the stuck days setting', async () => {
    const w = world();
    w.data.thresholds.stuckDays = 5;
    w.data.stuck = [lead('l1', 'FOLLOW_UP', 8)];
    const block = (await w.run.execute(ADMIN, {})).attention!.stagnantLeads;
    expect(block.items[0]).toMatchObject({
      title: 'Lead l1',
      detail: 'Follow-up for 8 days',
      ref: { kind: 'LEAD', id: 'l1' },
    });
    const q = w.calls['findStuck']![0]![0] as { before: Date; excludeStatuses: string[] };
    expect(q.excludeStatuses).toEqual(['PROPOSAL_SENT']);
    expect(at(NOW).getTime() - q.before.getTime()).toBe(5 * DAY);
  });

  it('uses the Admin-editable thresholds for each rule', async () => {
    const w = world();
    w.data.thresholds = { unseenDays: 7, noActionDays: 4, stuckDays: 2, complaintDays: 10 };
    await w.run.execute(ADMIN, {});
    const ago = (name: string) =>
      at(NOW).getTime() - (w.calls[name]![0]![0] as { before: Date }).before.getTime();
    expect(ago('findUnseen')).toBe(7 * DAY);
    expect(ago('findSeen')).toBe(4 * DAY);
    expect(ago('findStale')).toBe(10 * DAY);
  });

  it('complaints and to-dos: the oldest ten are shown, the count is capped at 50', async () => {
    const w = world();
    w.data.staleComplaints = Array.from({ length: 60 }, (_, i) => ({
      id: `c${i}`,
      projectId: 'p',
      projectName: 'Rao Kitchen',
      description: 'Drawer jammed',
      assignedToId: null,
      reopenCount: 0,
      activeSince: new Date(at(NOW).getTime() - (10 + i) * DAY),
    }));
    w.data.overdueTodos = [
      {
        id: 't1',
        title: 'Check board',
        projectId: 'p',
        projectName: 'Rao Kitchen',
        dueOn: '2026-11-08',
        assigneeIds: [],
        createdById: 'u1',
      },
    ];
    const a = (await w.run.execute(ADMIN, {})).attention!;
    expect(a.overdueComplaints).toMatchObject({ total: 50, capped: true });
    expect(a.overdueComplaints.items).toHaveLength(10);
    expect(a.overdueComplaints.items[0]).toMatchObject({
      title: 'Rao Kitchen',
      ref: { kind: 'COMPLAINT', id: 'c0', projectId: 'p' },
    });
    expect(a.overdueTodos.items[0]).toMatchObject({
      title: 'Check board',
      detail: 'Rao Kitchen — due 2026-11-08',
      ref: { kind: 'TODO', id: 't1' },
    });
    expect(a.unseenProposals).toEqual({ total: 0, capped: false, items: [] });
  });
});

describe('recent customer activity', () => {
  it('names the project and the customer, and drops what it cannot place', async () => {
    const w = world();
    w.data.projectNames.set('p1', 'Rao Kitchen');
    w.data.users.set('c1', 'Mrs Rao');
    w.data.customerFeed = [
      {
        kind: 'COMMENT',
        at: at('2026-11-11T09:00:00Z'),
        projectId: 'p1',
        postId: 'po1',
        authorId: 'c1',
        snippet: 'Please change the handle',
        hasPhotos: false,
      },
      {
        kind: 'APPROVAL',
        at: at('2026-11-10T09:00:00Z'),
        projectId: 'gone',
        postId: 'po2',
        authorId: 'c1',
        snippet: null,
        hasPhotos: true,
      },
    ];
    const recent = (await w.run.execute(ADMIN, {})).recent!;
    expect(recent).toEqual([
      {
        kind: 'COMMENT',
        at: '2026-11-11T09:00:00.000Z',
        projectId: 'p1',
        projectName: 'Rao Kitchen',
        postId: 'po1',
        authorName: 'Mrs Rao',
        snippet: 'Please change the handle',
        hasPhotos: false,
      },
    ]);
  });

  it('is an empty list, not an error, when there is nothing', async () => {
    expect((await world().run.execute(ADMIN, {})).recent).toEqual([]);
  });
});

describe('HR sees attendance only', () => {
  it('gets the present/absent counters and attendance columns; everything else is null', async () => {
    const w = world();
    w.data.dayCounts = { date: '', offDay: false, tracked: 6, present: 4, absent: 2 };
    w.data.staff = [staff({ id: 'u1', name: 'Ravi' })];
    w.data.attendance = [
      {
        userId: 'u1',
        daysPresent: 3,
        inAt: at('2026-11-11T03:35:00Z'),
        outAt: at('2026-11-11T12:30:00Z'),
      },
    ];
    w.data.leadActivity = [
      { userId: 'u1', actions: 99, leadsHandled: 9, firstAt: at(NOW), lastAt: at(NOW) },
    ];
    const d = await w.run.execute(HR, { from: '2026-11-09', to: '2026-11-11' });
    expect(d.staff).toMatchObject({ tracked: 6, present: 4, absent: 2 });
    expect(d.counters).toBeNull();
    expect(d.attention).toBeNull();
    expect(d.recent).toBeNull();
    expect(d.people).toEqual([
      {
        userId: 'u1',
        name: 'Ravi',
        designation: 'Executive',
        attendance: {
          daysPresent: 3,
          inAt: '2026-11-11T03:35:00.000Z',
          outAt: '2026-11-11T12:30:00.000Z',
        },
        activity: null,
        target: null,
      },
    ]);
    expect(w.calls['leadActivity']).toBeUndefined(); // never even asked
    expect(w.calls['findUnseen']).toBeUndefined();
    expect(d.errors).toEqual([]);
  });
});

describe('one source failing does not blank the page', () => {
  it('names the failed block and still returns the rest', async () => {
    const w = world();
    w.data.dayCounts = { date: '', offDay: false, tracked: 3, present: 2, absent: 1 };
    w.fail('projects'); // used by the counters
    const d = await w.run.execute(ADMIN, {});
    expect(d.counters).toBeNull();
    expect(d.errors).toEqual(['counters']);
    expect(d.staff).toMatchObject({ present: 2 });
    expect(d.people).not.toBeNull();
    expect(d.attention).not.toBeNull();
  });

  it('the recent feed and the people block fail independently', async () => {
    const w = world();
    w.fail('feed');
    w.fail('leads');
    const d = await w.run.execute(ADMIN, {});
    expect(d.recent).toBeNull();
    expect(d.people).toBeNull(); // activity needs leads
    expect(d.counters).toBeNull(); // so do the counters
    expect([...d.errors].sort()).toEqual(['counters', 'people', 'recent']);
    expect(d.staff).not.toBeNull();
    expect(d.attention).not.toBeNull();
  });
});

describe('monthly sales targets', () => {
  it('shows each person’s rupee target and what they have won this month, priced by the latest sent proposal', async () => {
    const w = world();
    w.data.staff = [
      staff({ id: 'u1', name: 'Ravi' }),
      staff({ id: 'u2', name: 'Rita' }),
      staff({ id: 'u3', name: 'Anil' }),
    ];
    w.data.targets = [
      { userId: 'u1', amount: 600_000, carriedFrom: null },
      { userId: 'u2', amount: 400_000, carriedFrom: '2026-10' },
    ];
    w.data.wonLeads = [
      { leadId: 'l1', assignedToId: 'u1' },
      { leadId: 'l2', assignedToId: 'u1' },
      { leadId: 'l3', assignedToId: null }, // nobody's: counts for no one
    ];
    w.data.totals = [
      { leadId: 'l1', total: 250_000 },
      { leadId: 'l2', total: 100_000 },
      { leadId: 'l3', total: 900_000 },
    ];
    const d = await w.run.execute(ADMIN, { from: '2026-11-05', to: '2026-11-11' });
    const by = Object.fromEntries(d.people!.map((p) => [p.name, p.target]));
    expect(by['Ravi']).toEqual({
      month: '2026-11',
      amount: 600_000,
      achieved: 350_000,
      carriedFrom: null,
    });
    expect(by['Rita']).toEqual({
      month: '2026-11',
      amount: 400_000,
      achieved: 0,
      carriedFrom: '2026-10',
    });
    expect(by['Anil']).toEqual({ month: '2026-11', amount: 0, achieved: 0, carriedFrom: null });
    // The window is the whole month so far, not just the chosen range.
    const [from] = w.calls['wonLeads']![0] as [Date];
    expect(from.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });

  it('a failing targets source drops only the target column', async () => {
    const w = world();
    w.data.staff = [staff({ id: 'u1', name: 'Ravi' })];
    w.fail('targets');
    const d = await w.run.execute(ADMIN, {});
    expect(d.errors).toEqual([]);
    expect(d.people![0]!.target).toBeNull();
  });
});
