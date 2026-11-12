import { BUILTIN_PROPOSAL_TEMPLATES, proposalTemplateSchema } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import type { DocumentView } from '../proposal-document';
import { FIRST_PAGE_ROWS, NEXT_PAGE_ROWS, planSheets } from './template-document';
import { fillTokens, tokenValues } from './tokens';

const item = (n: number) => ({
  title: `Item ${n}`,
  description: null,
  quantity: 1,
  unitPrice: 1000,
  lineTotal: 1000,
});

const doc = (count: number): DocumentView => ({
  number: 'VK-2026-0001',
  title: 'Modular kitchen',
  issuedAt: '2026-11-12T00:00:00.000Z',
  validUntil: null,
  customer: { name: 'Asha Rai', city: null, siteAddress: 'Hill Cart Road' },
  items: Array.from({ length: count }, (_, i) => item(i + 1)),
  subtotal: count * 1000,
  discount: 0,
  total: count * 1000,
  notes: null,
  terms: 'Terms',
});

describe('built-in proposal templates', () => {
  it.each(BUILTIN_PROPOSAL_TEMPLATES.map((t) => [t.key, t] as const))('%s is valid', (_k, t) => {
    expect(proposalTemplateSchema.safeParse(t).success).toBe(true);
    expect(t.pages[0]?.kind).toBe('cover');
    expect(t.pages.at(-1)?.kind).toBe('thankyou');
  });

  it('only uses known tokens', () => {
    const known = Object.keys(tokenValues(doc(1)));
    for (const t of BUILTIN_PROPOSAL_TEMPLATES) {
      for (const [, key] of JSON.stringify(t).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
        expect(known).toContain(key);
      }
    }
  });
});

describe('fillTokens', () => {
  const v = tokenValues(doc(1));
  it('fills known tokens and leaves unknown ones visible', () => {
    expect(fillTokens('Hi {{client.name}} {{nope}}', v)).toBe('Hi Asha Rai {{nope}}');
  });
  it('drops the separator an empty token leaves behind', () => {
    expect(fillTokens('{{client.address}}, {{client.city}}', v)).toBe('Hill Cart Road');
  });
  it('keeps paragraph breaks', () => {
    expect(fillTokens('One\n\nTwo', v)).toBe('One\n\nTwo');
  });
});

describe('planSheets', () => {
  const modern = BUILTIN_PROPOSAL_TEMPLATES[0]!;
  it('keeps one sheet per page for a short quote', () => {
    expect(planSheets(modern, doc(3))).toHaveLength(modern.pages.length);
  });
  it('splits a long price table and shows totals only on the last sheet', () => {
    const n = FIRST_PAGE_ROWS + NEXT_PAGE_ROWS + 2;
    const sheets = planSheets(modern, doc(n)).filter((s) => s.rows);
    expect(sheets).toHaveLength(3);
    expect(sheets.map((s) => s.rows!.showTotals)).toEqual([false, false, true]);
    expect(sheets.reduce((sum, s) => sum + s.rows!.items.length, 0)).toBe(n);
    expect(sheets.map((s) => s.rows!.offset)).toEqual([0, FIRST_PAGE_ROWS, FIRST_PAGE_ROWS + NEXT_PAGE_ROWS]);
  });
});
