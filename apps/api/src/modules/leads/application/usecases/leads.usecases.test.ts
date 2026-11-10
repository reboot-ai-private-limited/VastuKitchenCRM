import { describe, expect, it } from 'vitest';
import { AssignLeadUseCase } from './assignLead.usecase.js';
import { ImportLeadsUseCase } from './importLeads.usecase.js';
import { ListLeadsUseCase } from './listLeads.usecase.js';
import { addLead, admin, office, sales1, world } from '../testing/fakes.js';
import { isStuck } from '../../domain/lead.entity.js';

const query = { page: 1, pageSize: 20 };

describe('ListLeadsUseCase scope', () => {
  it('forces Sales to their own leads, whatever filter they ask for', async () => {
    const w = world();
    await addLead(w, { assignedToId: 'sales1' });
    await addLead(w, { phone: '9876500002', assignedToId: 'sales2' });
    const list = new ListLeadsUseCase(w.leads, w.views, 2);

    const asSales = await list.execute(sales1, { ...query, assignedTo: 'sales2' });
    expect(asSales.items.map((i) => i.lead.assignedToId)).toEqual(['sales1']);
  });

  it('lets Admin and Office see everyone, and filter unassigned', async () => {
    const w = world();
    await addLead(w, { assignedToId: 'sales1' });
    await addLead(w, { phone: '9876500002', assignedToId: null });
    const list = new ListLeadsUseCase(w.leads, w.views, 2);
    expect((await list.execute(admin, query)).total).toBe(2);
    expect((await list.execute(office, query)).total).toBe(2);
    expect((await list.execute(admin, { ...query, assignedTo: 'unassigned' })).items).toHaveLength(
      1,
    );
  });
});

describe('stuck', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
  it('is true only past the threshold and never for Won/Lost', () => {
    expect(isStuck({ status: 'CONTACTED', statusChangedAt: days(1) }, 2, now)).toBe(false);
    expect(isStuck({ status: 'CONTACTED', statusChangedAt: days(3) }, 2, now)).toBe(true);
    expect(isStuck({ status: 'WON', statusChangedAt: days(30) }, 2, now)).toBe(false);
    expect(isStuck({ status: 'LOST', statusChangedAt: days(30) }, 2, now)).toBe(false);
  });
});

describe('AssignLeadUseCase', () => {
  it('assigns only to sales people, and can unassign', async () => {
    const w = world();
    const lead = await addLead(w, { assignedToId: null });
    const assign = new AssignLeadUseCase(w.leads, w.activities, w.directory, w.views);
    await expect(assign.execute(admin, lead.id, { userId: 'designer1' })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(assign.execute(admin, lead.id, { userId: 'nobody' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect((await assign.execute(admin, lead.id, { userId: 'sales2' })).assigneeName).toBe('Asha');
    expect((await assign.execute(admin, lead.id, { userId: null })).lead.assignedToId).toBeNull();
    expect(w.activities.types(lead.id).filter((t) => t === 'ASSIGNED')).toHaveLength(2);
  });
});

describe('ImportLeadsUseCase', () => {
  it('creates valid rows, reports invalid and duplicate ones, and never overwrites', async () => {
    const w = world();
    const existing = await addLead(w, { phone: '9876500001', name: 'Original' });
    const importLeads = new ImportLeadsUseCase(w.leads, w.activities);

    const result = await importLeads.execute(office, {
      defaultSource: 'JUSTDIAL',
      rows: [
        { name: 'Asha', phone: '98765 00002' }, //                     ok, default source
        { name: 'Bina', phone: '+91 9876500003', source: 'facebook' }, // ok, source normalised
        { name: 'Dup', phone: '9876500001' }, //                       exists already
        { name: 'Asha again', phone: '9876500002' }, //                repeats inside the file
        { name: '', phone: '123' }, //                                 invalid
        { name: 'Cee', phone: '9876500004', source: 'nonsense', email: 'not-an-email' }, // invalid email
      ],
    });

    expect(result.created).toBe(2);
    expect(result.duplicates).toEqual([
      { row: 3, phone: '9876500001', existingLeadId: existing.id },
      { row: 4, phone: '9876500002', existingLeadId: null },
    ]);
    expect(result.invalid.map((i) => i.row)).toEqual([5, 6]);
    expect(w.leads.rows.find((l) => l.phone === '9876500001')?.name).toBe('Original');
    expect(w.leads.rows.find((l) => l.phone === '9876500002')?.source).toBe('JUSTDIAL');
    expect(w.leads.rows.find((l) => l.phone === '9876500003')?.source).toBe('FACEBOOK');
    expect(
      w.leads.rows.filter((l) => l.createdById === 'office1').every((l) => l.assignedToId === null),
    ).toBe(true);
  });
});
