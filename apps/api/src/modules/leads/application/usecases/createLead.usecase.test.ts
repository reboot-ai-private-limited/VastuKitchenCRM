import { describe, expect, it } from 'vitest';
import { CreateLeadUseCase } from './createLead.usecase.js';
import { addLead, admin, office, sales1, world } from '../testing/fakes.js';

const input = { name: 'Mrs Rao', phone: '9876500001', source: 'FACEBOOK' as const };

describe('CreateLeadUseCase', () => {
  it('gives a lead added by a sales person to that person', async () => {
    const w = world();
    const lead = await new CreateLeadUseCase(w.leads, w.activities).execute(sales1, input);
    expect(lead.assignedToId).toBe('sales1');
    expect(lead.status).toBe('NEW');
    expect(w.activities.types(lead.id)).toEqual(['CREATED']);
  });

  it('leaves Admin and Office leads unassigned', async () => {
    const w = world();
    const create = new CreateLeadUseCase(w.leads, w.activities);
    expect((await create.execute(admin, input)).assignedToId).toBeNull();
    expect(
      (await create.execute(office, { ...input, phone: '9876500002' })).assignedToId,
    ).toBeNull();
  });

  it('refuses a duplicate phone and says which lead already has it', async () => {
    const w = world();
    const existing = await addLead(w);
    await expect(
      new CreateLeadUseCase(w.leads, w.activities).execute(sales1, input),
    ).rejects.toMatchObject({
      statusCode: 409,
      publicDetails: { existingLeadId: existing.id },
    });
  });
});

describe('CreateLeadUseCase events', () => {
  it('announces the new lead', async () => {
    const w = world();
    const lead = await new CreateLeadUseCase(w.leads, w.activities, undefined, w.events).execute(
      sales1,
      input,
    );
    expect(w.events.created).toEqual([
      expect.objectContaining({ leadId: lead.id, assignedToId: sales1.id, byUserId: sales1.id }),
    ]);
  });
});
