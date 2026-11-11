import type { LeadDto } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import {
  addToBoard,
  boardLeads,
  boardTotal,
  movedLead,
  removeFromBoard,
  type BoardData,
} from './board';

const lead = (id: string): LeadDto => ({
  id,
  name: id,
  phone: '9000000000',
  altPhone: null,
  email: null,
  city: null,
  notes: null,
  source: 'OTHER',
  status: 'NEW',
  statusChangedAt: '2026-01-01T00:00:00Z',
  isStuck: true,
  assignedTo: null,
  lostReason: null,
  customerId: null,
  createdAt: '2026-01-01T00:00:00Z',
});
const data = (...ids: string[]): BoardData => ({
  pageParams: [1],
  pages: [{ items: ids.map(lead), page: 1, pageSize: 50, total: 80, totalPages: 2 }],
});

describe('board cache', () => {
  it('removes a card and lowers the count', () => {
    const d = removeFromBoard(data('a', 'b'), 'a');
    expect(boardLeads(d).map((l) => l.id)).toEqual(['b']);
    expect(boardTotal(d)).toBe(79);
  });
  it('leaves a column alone if the card is not in it', () => {
    const d = data('a');
    expect(removeFromBoard(d, 'zzz')).toBe(d);
  });
  it('adds a card on top and raises the count, once', () => {
    const d = addToBoard(data('a'), lead('n'));
    expect(boardLeads(d).map((l) => l.id)).toEqual(['n', 'a']);
    expect(boardTotal(d)).toBe(81);
    expect(addToBoard(d, lead('n'))).toBe(d);
  });
  it('marks a moved lead fresh', () => {
    const m = movedLead(lead('a'), 'VISIT', new Date('2026-02-02T00:00:00Z'));
    expect(m).toMatchObject({
      status: 'VISIT',
      isStuck: false,
      statusChangedAt: '2026-02-02T00:00:00.000Z',
    });
  });
});
