import { describe, expect, it } from 'vitest';
import { ChangeLeadStatusUseCase } from './changeLeadStatus.usecase.js';
import { addLead, admin, sales1, sales2, world } from '../testing/fakes.js';

function setup(now = () => new Date()) {
  const w = world(now);
  const change = new ChangeLeadStatusUseCase(
    w.access,
    w.leads,
    w.activities,
    w.directory,
    w.events,
    w.views,
    now,
  );
  return { w, change };
}

describe('ChangeLeadStatusUseCase', () => {
  it('moves between any two statuses (not a strict funnel) and logs each change', async () => {
    const { w, change } = setup();
    const lead = await addLead(w);
    for (const status of ['PROPOSAL_SENT', 'VISIT', 'PROPOSAL_SENT', 'FOLLOW_UP'] as const) {
      await change.execute(sales1, lead.id, { status });
    }
    expect(w.leads.rows[0]?.status).toBe('FOLLOW_UP');
    expect(w.activities.types(lead.id).filter((t) => t === 'STATUS_CHANGED')).toHaveLength(4);
  });

  it('resets statusChangedAt', async () => {
    let t = new Date('2026-11-01T10:00:00Z');
    const { w, change } = setup(() => t);
    const lead = await addLead(w, { statusChangedAt: new Date('2026-10-01T00:00:00Z') });
    t = new Date('2026-11-10T10:00:00Z');
    await change.execute(sales1, lead.id, { status: 'CONTACTED' });
    expect(w.leads.rows[0]?.statusChangedAt).toEqual(t);
  });

  it('refuses the status it is already in', async () => {
    const { w, change } = setup();
    const lead = await addLead(w);
    await expect(change.execute(sales1, lead.id, { status: 'NEW' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('records the reason when lost, and clears it when reopened', async () => {
    const { w, change } = setup();
    const lead = await addLead(w);
    await change.execute(sales1, lead.id, { status: 'LOST', lostReason: 'Too expensive' });
    expect(w.leads.rows[0]?.lostReason).toBe('Too expensive');
    await change.execute(sales1, lead.id, { status: 'FOLLOW_UP' });
    expect(w.leads.rows[0]?.lostReason).toBeNull();
  });

  it('on WON creates the customer, stores it, and announces lead.won once', async () => {
    const { w, change } = setup();
    const lead = await addLead(w);
    const view = await change.execute(sales1, lead.id, { status: 'WON' });
    expect(view.lead.customerId).toBe('cust-9876500001');
    expect(w.events.won).toEqual([
      {
        leadId: lead.id,
        customerId: 'cust-9876500001',
        name: 'Mrs Rao',
        phone: '9876500001',
        byUserId: 'sales1',
      },
    ]);

    // Away and back: no second customer lookup, no second announcement (no second project).
    await change.execute(sales1, lead.id, { status: 'FOLLOW_UP' });
    await change.execute(sales1, lead.id, { status: 'WON' });
    expect(w.events.won).toHaveLength(1);
    expect(w.directory.customersCreated).toHaveLength(1);
  });

  it("hides other people's leads from Sales as not found, but lets Admin act on any", async () => {
    const { w, change } = setup();
    const lead = await addLead(w, { assignedToId: 'sales1' });
    await expect(change.execute(sales2, lead.id, { status: 'CONTACTED' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(change.execute(admin, lead.id, { status: 'CONTACTED' })).resolves.toBeDefined();
  });
});
