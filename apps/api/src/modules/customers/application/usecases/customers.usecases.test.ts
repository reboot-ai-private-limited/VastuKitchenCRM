import { describe, expect, it } from 'vitest';
import { admin, sales1, sales2, world } from '../testing/fakes.js';

const sen = { name: 'Mrs Sen', phone: '9811100001', city: 'Siliguri' };

describe('adding a customer', () => {
  it('creates the account and the lead, and shows them with no project yet', async () => {
    const w = world();
    const c = await w.add.execute(sales1, sen);
    expect(c.lead).toMatchObject({ name: 'Mrs Sen', phone: '9811100001', status: 'WON' });
    expect(c.projects).toHaveLength(0);
    expect(c.owner).toEqual({ id: 'sales1', name: 'Ravi' });
    expect(w.identity.accounts.size).toBe(1);
  });

  it('refuses someone who is already a customer, pointing at them; and a staff phone', async () => {
    const w = world();
    const first = await w.add.execute(sales1, sen);
    await expect(w.add.execute(sales1, sen)).rejects.toMatchObject({
      statusCode: 409,
      publicDetails: { existingCustomerId: first.lead.customerId },
    });
    w.identity.staffPhones.add('9811100002');
    await expect(
      w.add.execute(sales1, { name: 'Staff', phone: '9811100002' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('the list', () => {
  it('puts customers with a project first, then by recent activity, and scopes Sales to theirs', async () => {
    const w = world();
    await w.add.execute(sales1, sen);
    const b = await w.add.execute(sales1, { name: 'Mr Das', phone: '9811100002' });
    await w.add.execute(sales2, { name: 'Mr Roy', phone: '9811100003' });
    w.projects.rows.push({
      id: 'p1',
      name: 'Das Wardrobe',
      customerId: b.lead.customerId,
      stage: 'SITE',
      createdAt: new Date('2026-11-05T10:00:00Z'),
    });
    const all = await w.list.execute(admin, { page: 1, pageSize: 24 });
    expect(all.items.map((v) => v.lead.name)).toEqual(['Mr Das', 'Mrs Sen', 'Mr Roy']);
    expect(all.items[0]).toMatchObject({ projects: [{ id: 'p1' }] });
    const mine = await w.list.execute(sales1, { page: 1, pageSize: 24 });
    expect(mine.items.map((v) => v.lead.name).sort()).toEqual(['Mr Das', 'Mrs Sen']);
  });

  it('counts active projects and notices a new project in progress', async () => {
    const w = world();
    const c = await w.add.execute(sales1, sen);
    const id = c.lead.customerId;
    w.projects.rows.push(
      {
        id: 'p1',
        name: 'Kitchen',
        customerId: id,
        stage: 'CLOSED',
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'p2',
        name: 'Wardrobe',
        customerId: id,
        stage: 'DESIGN',
        createdAt: new Date('2026-06-01'),
      },
    );
    const v = await w.get.execute(sales1, id);
    expect(v.projects.map((p) => p.id)).toEqual(['p2', 'p1']); // newest first
    await w.start.execute(sales1, id);
    expect(w.leads.started).toEqual([id]);
  });
});

describe('importing customers', () => {
  it('adds the valid rows and reports the rest, one bad row never failing the file', async () => {
    const w = world();
    w.identity.staffPhones.add('9811100009');
    w.leads.plainLeads.add('9811100002'); // already a lead: linked
    const r = await w.importer.execute(sales1, {
      rows: [
        { name: 'Mrs Sen', phone: '9811100001', city: 'Siliguri' },
        { name: 'Mr Das', phone: '+91 98111 00002' },
        { name: '', phone: '9811100003' }, // no name
        { name: 'Bad phone', phone: '12345' },
        { name: 'Mrs Sen again', phone: '9811100001' }, // repeat inside the file
        { name: 'Staff', phone: '9811100009' }, // belongs to staff
      ],
    });
    expect(r.created).toBe(1);
    expect(r.linked).toBe(1);
    expect(r.existing.map((e) => e.row)).toEqual([5]);
    expect(r.invalid.map((i) => i.row)).toEqual([3, 4, 6]);
    expect(w.leads.rows).toHaveLength(2);
  });
});

describe('starting a new project', () => {
  it('puts the lead back in the pipeline, and another Sales person cannot', async () => {
    const w = world();
    const c = await w.add.execute(sales1, sen);
    const v = await w.start.execute(sales1, c.lead.customerId);
    expect(v.lead.status).toBe('NEW');
    await expect(w.start.execute(sales2, c.lead.customerId)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
