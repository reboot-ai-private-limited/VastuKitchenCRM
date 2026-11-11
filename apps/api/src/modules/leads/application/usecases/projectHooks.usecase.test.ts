import { describe, expect, it } from 'vitest';
import { GetLeadJourneyUseCase, RecordProjectEventUseCase } from './projectHooks.usecase.js';
import { UpdateLeadUseCase } from './updateLead.usecase.js';
import { addLead, admin, sales1, sales2, world } from '../testing/fakes.js';

describe('won leads: what can still change', () => {
  it('never lets the phone number change (the customer signs in with it), not even for the Admin', async () => {
    const w = world();
    const lead = await addLead(w, { status: 'WON' });
    const update = new UpdateLeadUseCase(w.access, w.leads, w.views);
    await expect(update.execute(admin, lead.id, { phone: '9000000000' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(update.execute(sales1, lead.id, { phone: '9000000000' })).rejects.toMatchObject({
      statusCode: 403,
    });
    // Everything else stays editable, and re-sending the SAME number is not a change.
    await expect(
      update.execute(sales1, lead.id, {
        city: 'Matigara',
        notes: 'Wants an island',
        phone: lead.phone,
      }),
    ).resolves.toBeDefined();
    expect(w.leads.rows[0]?.city).toBe('Matigara');
  });

  it('still lets an open lead change its phone', async () => {
    const w = world();
    const lead = await addLead(w, { status: 'CONTACTED' });
    const update = new UpdateLeadUseCase(w.access, w.leads, w.views);
    await expect(update.execute(sales1, lead.id, { phone: '9000000000' })).resolves.toBeDefined();
  });
});

describe('project events and the journey', () => {
  it('records project events on the lead timeline, and returns the story oldest first', async () => {
    const w = world();
    const lead = await addLead(w);
    await w.activities.add({
      leadId: lead.id,
      type: 'CREATED',
      byUserId: 'sales1',
      at: new Date('2026-10-01T10:00:00Z'),
      data: {},
    });
    await new RecordProjectEventUseCase(
      w.activities,
      () => new Date('2026-10-20T10:00:00Z'),
    ).execute(lead.id, {
      type: 'PROJECT_CREATED',
      projectName: "Mrs Rao's project",
      byUserId: 'sales1',
    });

    const journey = await new GetLeadJourneyUseCase(w.access, w.activities, w.directory).execute(
      admin,
      lead.id,
    );
    expect(journey.map((e) => e.type)).toEqual(['CREATED', 'PROJECT_CREATED']);
    expect(journey[1]).toMatchObject({
      byName: 'Ravi',
      data: { projectName: "Mrs Rao's project" },
    });
  });

  it('is only for someone who may access the lead', async () => {
    const w = world();
    const lead = await addLead(w, { assignedToId: 'sales1' });
    const journey = new GetLeadJourneyUseCase(w.access, w.activities, w.directory);
    await expect(journey.execute(sales1, lead.id)).resolves.toBeDefined();
    await expect(journey.execute(sales2, lead.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});
