import { describe, expect, it } from 'vitest';
import { A, ID, hex, photo, world } from '../testing/fakes.js';

const raiseAs = (w: ReturnType<typeof world>, actor = A.customer) =>
  w.raise.execute(actor, {
    projectId: ID.project,
    description: 'Drawer slider is jammed',
    images: [photo('p1')],
  });

/** A complaint that is OPEN, ASSIGNED to the technician, or RESOLVED by them. */
async function inState(state: 'OPEN' | 'ASSIGNED' | 'RESOLVED') {
  const w = world();
  const c = await raiseAs(w);
  if (state !== 'OPEN') await w.assign.execute(A.admin, c.complaint.id, { assigneeId: ID.tech });
  if (state === 'RESOLVED')
    await w.resolve.execute(A.tech, c.complaint.id, {
      note: 'Replaced the slider',
      images: [photo('done')],
    });
  w.sender.clear();
  w.projects.activities.length = 0;
  return { w, id: c.complaint.id };
}

describe('raising a complaint', () => {
  it('the customer raises one on their own project: OPEN, with photo, history and a timeline line', async () => {
    const w = world();
    const c = await raiseAs(w);
    expect(c.status).toBe('OPEN');
    expect(c.complaint).toMatchObject({
      projectId: ID.project,
      customerId: ID.customer,
      raisedById: ID.customer,
    });
    expect(c.images).toHaveLength(1);
    expect(c.history.map((h) => h.type)).toEqual(['RAISED']);
    expect(c.projectName).toBe('Rao Kitchen');
    expect(w.projects.activities).toMatchObject([
      { projectId: ID.project, type: 'COMPLAINT_RAISED', actorId: ID.customer },
    ]);
  });

  it('tells every Admin, and never the person who raised it', async () => {
    const w = world();
    await raiseAs(w, A.admin);
    expect(w.sender.sent).toHaveLength(0);
    await raiseAs(w, A.office);
    expect(w.sender.to(ID.admin, 'COMPLAINT_RAISED')).toHaveLength(1);
    expect(w.sender.to(ID.office)).toHaveLength(0);
  });

  it('who may raise: the customer (own project), Office, Admin, and members — not Technicians or HR', async () => {
    const w = world();
    await expect(raiseAs(w, A.customer2)).rejects.toMatchObject({ statusCode: 404 }); // someone else's project
    await expect(raiseAs(w, A.office)).resolves.toBeTruthy(); // any project
    await expect(raiseAs(w, A.admin)).resolves.toBeTruthy();
    await expect(raiseAs(w, A.sales)).resolves.toBeTruthy(); // a member
    await expect(raiseAs(w, A.salesOther)).rejects.toMatchObject({ statusCode: 404 }); // not a member
    await expect(raiseAs(w, A.tech)).rejects.toMatchObject({ statusCode: 403 });
    await expect(raiseAs(w, A.hr)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('an unknown or malformed project is not found', async () => {
    const w = world();
    for (const projectId of [hex(999), 'nope'])
      await expect(
        w.raise.execute(A.office, { projectId, description: 'x' }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
  });

  it("refuses another project's photo", async () => {
    const w = world();
    await expect(
      w.raise.execute(A.customer, {
        projectId: ID.project,
        description: 'x',
        images: [{ publicId: `vastu-test/projects/${ID.otherProject}/p1` }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('the upload ticket is for the project photo folder, under the same raise rules', async () => {
    const w = world();
    expect((await w.signRaise.execute(A.customer, ID.project)).fields['folder']).toBe(
      `vastu-test/projects/${ID.project}`,
    );
    await expect(w.signRaise.execute(A.customer2, ID.project)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(w.signRaise.execute(A.tech, ID.project)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('who sees which complaint', () => {
  it('Admin and Office see all; the customer, a raiser and the technician only theirs', async () => {
    const w = world();
    const mine = await raiseAs(w); // customer's, on Rao
    await w.raise.execute(A.customer2, { projectId: ID.otherProject, description: 'Hinge broken' });
    await w.assign.execute(A.admin, mine.complaint.id, { assigneeId: ID.tech });

    const ids = async (a: typeof A.admin) =>
      (await w.list.execute(a, { page: 1, pageSize: 20 })).items.map((i) => i.complaint.id);
    expect(await ids(A.admin)).toHaveLength(2);
    expect(await ids(A.office)).toHaveLength(2);
    expect(await ids(A.customer)).toEqual([mine.complaint.id]);
    expect(await ids(A.tech)).toEqual([mine.complaint.id]);
    expect(await ids(A.tech2)).toEqual([]);
    expect(await ids(A.designer)).toEqual([]);
  });

  it('what you may not see is "not found", whether it exists or not', async () => {
    const { w, id } = await inState('ASSIGNED');
    const get = (a: typeof A.admin, cid = id) => w.access.load(cid, a);
    await expect(get(A.admin)).resolves.toBeTruthy();
    await expect(get(A.tech2)).rejects.toMatchObject({ statusCode: 404 });
    await expect(get(A.customer2)).rejects.toMatchObject({ statusCode: 404 });
    await expect(get(A.admin, hex(777))).rejects.toMatchObject({ statusCode: 404 });
    await expect(get(A.admin, 'zzz')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('filters by status and "assignedTo=me", and counts are scoped like the list', async () => {
    const w = world();
    const a = await raiseAs(w);
    await raiseAs(w, A.office);
    await w.assign.execute(A.admin, a.complaint.id, { assigneeId: ID.tech });

    const open = await w.list.execute(A.admin, { page: 1, pageSize: 20, status: 'OPEN' });
    expect(open.total).toBe(1);
    const mine = await w.list.execute(A.tech, { page: 1, pageSize: 20, assignedTo: 'me' });
    expect(mine.items.map((i) => i.complaint.id)).toEqual([a.complaint.id]);
    expect(await w.counts.execute(A.admin)).toEqual({
      OPEN: 1,
      ASSIGNED: 1,
      RESOLVED: 0,
      CLOSED: 0,
    });
    expect(await w.counts.execute(A.tech)).toEqual({
      OPEN: 0,
      ASSIGNED: 1,
      RESOLVED: 0,
      CLOSED: 0,
    });
  });

  it('pages the list', async () => {
    const w = world();
    for (let i = 0; i < 3; i++) await raiseAs(w);
    const page = await w.list.execute(A.admin, { page: 2, pageSize: 2 });
    expect(page).toMatchObject({ total: 3, totalPages: 2, page: 2 });
    expect(page.items).toHaveLength(1);
  });
});

describe('assigning', () => {
  it('the Admin assigns: ASSIGNED, history, timeline line, and the technician is told', async () => {
    const w = world();
    const c = await raiseAs(w);
    w.sender.clear();
    const out = await w.assign.execute(A.admin, c.complaint.id, { assigneeId: ID.tech });
    expect(out.status).toBe('ASSIGNED');
    expect(out.assignedTo).toMatchObject({ id: ID.tech });
    expect(out.history.map((h) => h.type)).toEqual(['RAISED', 'ASSIGNED']);
    expect(out.history[1]?.assignee).toMatchObject({ id: ID.tech });
    expect(w.sender.to(ID.tech, 'COMPLAINT_ASSIGNED')).toHaveLength(1);
    expect(w.projects.activities.at(-1)).toMatchObject({
      type: 'COMPLAINT_ASSIGNED',
      data: { assigneeId: ID.tech, assigneeName: 'tech' },
    });
  });

  it('only an Admin assigns (a technician not on it cannot even see it)', async () => {
    const w = world();
    const c = await raiseAs(w);
    for (const a of [A.office, A.customer])
      await expect(
        w.assign.execute(a, c.complaint.id, { assigneeId: ID.tech }),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
  });

  it('only to an active staff member', async () => {
    const w = world();
    const c = await raiseAs(w);
    for (const assigneeId of [ID.customer, ID.gone, hex(999)])
      await expect(w.assign.execute(A.admin, c.complaint.id, { assigneeId })).rejects.toMatchObject(
        {
          statusCode: 400,
        },
      );
  });

  it('can be re-assigned while ASSIGNED; assigning to the same person again does nothing', async () => {
    const { w, id } = await inState('ASSIGNED');
    await w.assign.execute(A.admin, id, { assigneeId: ID.tech });
    expect(w.sender.sent).toHaveLength(0);
    expect(w.projects.activities).toHaveLength(0);
    const out = await w.assign.execute(A.admin, id, { assigneeId: ID.tech2 });
    expect(out.assignedTo).toMatchObject({ id: ID.tech2 });
    expect(out.history.filter((h) => h.type === 'ASSIGNED')).toHaveLength(2);
  });

  it('not once it is resolved or closed', async () => {
    const { w, id } = await inState('RESOLVED');
    await expect(w.assign.execute(A.admin, id, { assigneeId: ID.tech2 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('resolving', () => {
  it('the assignee resolves with a note and photos; the Admins, customer and raiser are told', async () => {
    const { w, id } = await inState('ASSIGNED');
    const out = await w.resolve.execute(A.tech, id, {
      note: 'Replaced the slider',
      images: [photo('done')],
    });
    expect(out.status).toBe('RESOLVED');
    expect(out.resolutionImages).toHaveLength(1);
    expect(out.complaint.resolutionNote).toBe('Replaced the slider');
    expect(out.history.at(-1)).toMatchObject({ type: 'RESOLVED', note: 'Replaced the slider' });
    expect(w.sender.to(ID.admin, 'COMPLAINT_RESOLVED')).toHaveLength(1);
    expect(w.sender.to(ID.customer, 'COMPLAINT_RESOLVED')).toHaveLength(1); // customer is also the raiser: told once
    expect(w.sender.to(ID.tech)).toHaveLength(0);
    expect(w.projects.activities).toMatchObject([{ type: 'COMPLAINT_RESOLVED', actorId: ID.tech }]);
  });

  it('an Admin can resolve it too', async () => {
    const { w, id } = await inState('ASSIGNED');
    await expect(w.resolve.execute(A.admin, id, { note: 'Fixed by owner' })).resolves.toMatchObject(
      {
        status: 'RESOLVED',
      },
    );
  });

  it('not another technician (cannot even see it), not Office, not the customer', async () => {
    const { w, id } = await inState('ASSIGNED');
    await expect(w.resolve.execute(A.tech2, id, { note: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(w.resolve.execute(A.office, id, { note: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(w.resolve.execute(A.customer, id, { note: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('only while ASSIGNED, and only once (the second of two simultaneous resolves loses)', async () => {
    const open = world();
    const c = await raiseAs(open);
    await expect(
      open.resolve.execute(A.admin, c.complaint.id, { note: 'x' }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    const { w, id } = await inState('ASSIGNED');
    const results = await Promise.allSettled([
      w.resolve.execute(A.tech, id, { note: 'a' }),
      w.resolve.execute(A.admin, id, { note: 'b' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(w.complaints.rows[0]?.events.filter((e) => e.type === 'RESOLVED')).toHaveLength(1);
  });

  it("refuses another project's photo", async () => {
    const { w, id } = await inState('ASSIGNED');
    await expect(
      w.resolve.execute(A.tech, id, {
        note: 'x',
        images: [{ publicId: `vastu-test/projects/${ID.otherProject}/z` }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('the resolution photo ticket is only for someone who may resolve it', async () => {
    const { w, id } = await inState('ASSIGNED');
    expect((await w.signResolve.execute(A.tech, id)).fields['folder']).toBe(
      `vastu-test/projects/${ID.project}`,
    );
    await expect(w.signResolve.execute(A.office, id)).rejects.toMatchObject({ statusCode: 403 });
    const resolved = await inState('RESOLVED');
    await expect(resolved.w.signResolve.execute(A.tech, resolved.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('reopening', () => {
  it('the customer sends it back to the same technician; the resolution is cleared and counted', async () => {
    const { w, id } = await inState('RESOLVED');
    const out = await w.reopen.execute(A.customer, id, { reason: 'Still jams' });
    expect(out.status).toBe('ASSIGNED');
    expect(out.assignedTo).toMatchObject({ id: ID.tech });
    expect(out.complaint).toMatchObject({ reopenCount: 1, resolutionNote: null, resolvedAt: null });
    expect(out.resolutionImages).toEqual([]);
    expect(out.history.at(-1)).toMatchObject({ type: 'REOPENED', note: 'Still jams' });
    expect(w.sender.to(ID.tech, 'COMPLAINT_REOPENED')).toHaveLength(1);
    expect(w.sender.to(ID.admin, 'COMPLAINT_REOPENED')).toHaveLength(1);
    expect(w.projects.activities).toMatchObject([{ type: 'COMPLAINT_REOPENED' }]);
    // And the technician can resolve it again.
    await expect(w.resolve.execute(A.tech, id, { note: 'Re-fitted' })).resolves.toMatchObject({
      status: 'RESOLVED',
    });
  });

  it('an Admin can too; not Office, a technician, or someone else’s customer', async () => {
    const { w, id } = await inState('RESOLVED');
    await expect(w.reopen.execute(A.office, id, { reason: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(w.reopen.execute(A.tech, id, { reason: 'x' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(w.reopen.execute(A.customer2, id, { reason: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(w.reopen.execute(A.admin, id, { reason: 'x' })).resolves.toMatchObject({
      status: 'ASSIGNED',
    });
  });

  it('only a RESOLVED complaint can be reopened', async () => {
    const { w, id } = await inState('ASSIGNED');
    await expect(w.reopen.execute(A.customer, id, { reason: 'x' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('closing', () => {
  it('the Admin closes a resolved complaint and the customer is told', async () => {
    const { w, id } = await inState('RESOLVED');
    const out = await w.close.execute(A.admin, id, { note: 'Customer confirmed' });
    expect(out.status).toBe('CLOSED');
    expect(out.complaint.closedAt).toBeInstanceOf(Date);
    expect(out.history.at(-1)).toMatchObject({ type: 'CLOSED', note: 'Customer confirmed' });
    expect(w.sender.to(ID.customer, 'COMPLAINT_CLOSED')).toHaveLength(1);
    expect(w.projects.activities).toMatchObject([{ type: 'COMPLAINT_CLOSED' }]);
  });

  it('only the Admin, and only once resolved; a closed one is final', async () => {
    const { w, id } = await inState('RESOLVED');
    await expect(w.close.execute(A.office, id, {})).rejects.toMatchObject({ statusCode: 403 });
    await expect(w.close.execute(A.customer, id, {})).rejects.toMatchObject({ statusCode: 403 });
    await w.close.execute(A.admin, id, {});
    await expect(w.close.execute(A.admin, id, {})).rejects.toMatchObject({ statusCode: 409 });
    await expect(w.reopen.execute(A.customer, id, { reason: 'x' })).rejects.toMatchObject({
      statusCode: 409,
    });

    const assigned = await inState('ASSIGNED');
    await expect(assigned.w.close.execute(A.admin, assigned.id, {})).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('what the caller can do ("can")', () => {
  it('follows the status and the person', async () => {
    const w = world();
    const c = await raiseAs(w);
    const can = async (a: typeof A.admin) =>
      (await w.list.execute(a, { page: 1, pageSize: 5 })).items[0]?.can;
    expect(await can(A.admin)).toEqual({
      assign: true,
      resolve: false,
      reopen: false,
      close: false,
    });
    expect(await can(A.customer)).toEqual({
      assign: false,
      resolve: false,
      reopen: false,
      close: false,
    });

    await w.assign.execute(A.admin, c.complaint.id, { assigneeId: ID.tech });
    expect(await can(A.tech)).toEqual({
      assign: false,
      resolve: true,
      reopen: false,
      close: false,
    });
    expect(await can(A.admin)).toEqual({
      assign: true,
      resolve: true,
      reopen: false,
      close: false,
    });

    await w.resolve.execute(A.tech, c.complaint.id, { note: 'done' });
    expect(await can(A.customer)).toEqual({
      assign: false,
      resolve: false,
      reopen: true,
      close: false,
    });
    expect(await can(A.admin)).toEqual({
      assign: false,
      resolve: false,
      reopen: true,
      close: true,
    });
  });
});

describe('the reminder scan', () => {
  it('finds only unresolved complaints that have been waiting, oldest first', async () => {
    const { w } = await inState('ASSIGNED');
    const later = new Date('2026-11-20T00:00:00Z');
    expect(await w.complaints.findStale(new Date('2026-11-01T00:00:00Z'), 10)).toHaveLength(0);
    expect(await w.complaints.findStale(later, 10)).toHaveLength(1);
    const resolved = await inState('RESOLVED');
    expect(await resolved.w.complaints.findStale(later, 10)).toHaveLength(0);
  });
});
