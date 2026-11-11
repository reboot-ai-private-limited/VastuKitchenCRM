import type { LeadDto } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import { diffLead } from './edit-lead-dialog';

const lead: LeadDto = {
  id: '1',
  name: 'Rahul',
  phone: '9876543210',
  altPhone: null,
  email: 'r@x.com',
  city: 'Siliguri',
  notes: null,
  source: 'JUSTDIAL',
  status: 'NEW',
  statusChangedAt: '2026-01-01T00:00:00Z',
  isStuck: false,
  assignedTo: null,
  lostReason: null,
  customerId: null,
  createdAt: '2026-01-01T00:00:00Z',
};
const form = {
  name: 'Rahul',
  phone: '9876543210',
  altPhone: '',
  email: 'r@x.com',
  city: 'Siliguri',
  notes: '',
  source: 'JUSTDIAL' as const,
};

describe('diffLead', () => {
  it('sends nothing when nothing changed', () => expect(diffLead(lead, form)).toEqual({}));
  it('sends only what changed', () =>
    expect(diffLead(lead, { ...form, city: 'Gangtok', notes: 'Wants island' })).toEqual({
      city: 'Gangtok',
      notes: 'Wants island',
    }));
  it('clears an emptied optional field with null', () =>
    expect(diffLead(lead, { ...form, email: '' })).toEqual({ email: null }));
});
