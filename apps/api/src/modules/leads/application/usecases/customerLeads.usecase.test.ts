import { describe, expect, it } from 'vitest';
import {
  AddCustomerLeadUseCase,
  FindCustomerLeadUseCase,
  ListCustomerLeadsUseCase,
  StartNewProjectUseCase,
} from './customerLeads.usecase.js';
import { ChangeLeadStatusUseCase } from './changeLeadStatus.usecase.js';
import { addLead, admin, sales1, sales2, world } from '../testing/fakes.js';

function setup() {
  const w = world();
  return {
    w,
    add: new AddCustomerLeadUseCase(w.leads, w.activities, w.now),
    list: new ListCustomerLeadsUseCase(w.leads),
    find: new FindCustomerLeadUseCase(w.leads),
    start: new StartNewProjectUseCase(w.leads, w.activities, w.now),
    change: new ChangeLeadStatusUseCase(
      w.access,
      w.leads,
      w.activities,
      w.directory,
      w.events,
      w.views,
      w.now,
    ),
  };
}
const person = { name: 'Mrs Sen', phone: '9811100001', city: 'Siliguri', customerId: 'cust-sen' };

describe('adding a customer by hand', () => {
  it('creates their lead as WON from "Existing customer", owned by the Sales person, without a project', async () => {
    const { w, add } = setup();
    const r = await add.execute(sales1, person);
    expect(r.created).toBe(true);
    expect(w.leads.rows[0]).toMatchObject({
      status: 'WON',
      source: 'EXISTING_CUSTOMER',
      customerId: 'cust-sen',
      assignedToId: 'sales1',
      newProjectRequested: false,
    });
    expect(w.activities.types(r.lead.id)).toEqual(['CREATED']);
    expect(w.events.won).toHaveLength(0);
  });

  it('links the lead that already has this phone instead of making a duplicate', async () => {
    const { w, add } = setup();
    await addLead(w, { phone: person.phone, status: 'PROPOSAL_SENT' });
    const r = await add.execute(admin, person);
    expect(r.created).toBe(false);
    expect(w.leads.rows).toHaveLength(1);
    // Still open: when it is won, it makes the customer's project.
    expect(w.leads.rows[0]).toMatchObject({ customerId: 'cust-sen', newProjectRequested: true });
  });

  it('is repeatable, and refuses a phone that belongs to another customer', async () => {
    const { w, add } = setup();
    await add.execute(admin, person);
    const again = await add.execute(admin, person);
    expect(again.created).toBe(false);
    expect(w.leads.rows).toHaveLength(1);
    await expect(
      add.execute(admin, { ...person, customerId: 'someone-else' }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('the customer list', () => {
  it('shows leads with an account, and a Sales person only their own', async () => {
    const { w, add, list } = setup();
    await add.execute(sales1, person);
    await add.execute(sales2, {
      name: 'Mr Das',
      phone: '9811100002',
      city: null,
      customerId: 'cust-das',
    });
    await addLead(w, { phone: '9811100003' }); // an ordinary lead: not a customer
    const all = await list.execute(admin, { page: 1, pageSize: 20 });
    expect(all.items.map((c) => c.name).sort()).toEqual(['Mr Das', 'Mrs Sen']);
    const mine = await list.execute(sales1, { page: 1, pageSize: 20 });
    expect(mine.items.map((c) => c.name)).toEqual(['Mrs Sen']);
  });

  it('a lead outside your scope is not found', async () => {
    const { add, find } = setup();
    await add.execute(sales1, person);
    await expect(find.execute(sales2, 'cust-sen')).rejects.toMatchObject({ statusCode: 404 });
    await expect(find.execute(admin, 'cust-sen')).resolves.toMatchObject({ name: 'Mrs Sen' });
  });
});

describe('starting a new project for an existing customer', () => {
  it('puts the lead back to NEW on the same timeline, and the next win announces another project once', async () => {
    const { w, add, start, change } = setup();
    const { lead } = await add.execute(sales1, person);

    const started = await start.execute(sales1, 'cust-sen');
    expect(started.status).toBe('NEW');
    expect(w.leads.rows[0]?.newProjectRequested).toBe(true);
    expect(w.activities.types(lead.id)).toEqual(['CREATED', 'STATUS_CHANGED']);

    await change.execute(sales1, lead.id, { status: 'VISIT' });
    await change.execute(sales1, lead.id, { status: 'WON' });
    expect(w.events.won).toEqual([
      expect.objectContaining({ leadId: lead.id, customerId: 'cust-sen', again: true }),
    ]);
    // The request is used up: winning again by accident makes nothing new.
    expect(w.leads.rows[0]?.newProjectRequested).toBe(false);
    await change.execute(admin, lead.id, { status: 'FOLLOW_UP' });
    await change.execute(admin, lead.id, { status: 'WON' });
    expect(w.events.won).toHaveLength(1);
  });

  it("is harmless when already started, and refuses someone else's customer", async () => {
    const { w, add, start } = setup();
    await add.execute(sales1, person);
    await start.execute(sales1, 'cust-sen');
    const twice = await start.execute(sales1, 'cust-sen');
    expect(twice.status).toBe('NEW');
    expect(w.activities.types(w.leads.rows[0]!.id)).toHaveLength(2);
    await expect(start.execute(sales2, 'cust-sen')).rejects.toMatchObject({ statusCode: 404 });
  });
});
