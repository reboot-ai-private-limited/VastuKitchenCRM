import { describe, expect, it } from 'vitest';
import { buildBody, computeTotals, emptyForm, newItem, previewItems, proposalChip } from './proposals';

describe('computeTotals', () => {
  it('rounds each line like the API and subtracts the discount', () => {
    const t = computeTotals([{ quantity: 2.5, unitPrice: 1001 }, { quantity: 1, unitPrice: 500 }], 100);
    expect(t.lines).toEqual([2503, 500]);
    expect(t.subtotal).toBe(3003);
    expect(t.total).toBe(2903);
  });
});

describe('proposalChip', () => {
  it('derives Draft, Sent, Seen', () => {
    expect(proposalChip({ status: 'DRAFT', firstSeenAt: null }).label).toBe('Draft');
    expect(proposalChip({ status: 'SENT', firstSeenAt: null }).label).toBe('Sent');
    expect(proposalChip({ status: 'SENT', firstSeenAt: '2026-01-01T00:00:00Z' }).label).toBe('Seen');
  });
});

describe('buildBody', () => {
  const filled = () => ({ ...emptyForm(), items: [newItem({ title: 'Kitchen', quantity: '1', unitPrice: '250000' })] });
  it('accepts a filled form', () => {
    const r = buildBody(filled(), 'lead1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.create?.items[0]).toMatchObject({ title: 'Kitchen', unitPrice: 250000 });
  });
  it('points at the field that is wrong', () => {
    const r = buildBody({ ...emptyForm() }, 'lead1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['items.0.title', 'items.0.unitPrice']));
  });
  it('refuses a discount above the subtotal', () => {
    const r = buildBody({ ...filled(), discount: '300000' }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['discount']).toMatch(/subtotal/);
  });
  it('previews half-filled forms without NaN', () => {
    expect(previewItems(emptyForm())[0]).toMatchObject({ quantity: 1, unitPrice: 0 });
  });
});
