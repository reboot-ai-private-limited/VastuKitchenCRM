import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, filtersToSearch, formatPhone, leadPermissions, leadRowActions, parseFilters, telUrl, whatsappUrl } from './leads';

const params = (q: string) => new URLSearchParams(q);

describe('lead filters in the URL', () => {
  it('round-trips', () => {
    const f = { ...DEFAULT_FILTERS, search: 'sharma', status: 'VISIT' as const, source: 'JUSTDIAL' as const, assignedTo: 'me', stuck: true, page: 3, view: 'board' as const };
    expect(parseFilters(params(filtersToSearch(f)))).toEqual(f);
  });
  it('omits defaults', () => {
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe('');
  });
  it('ignores junk', () => {
    expect(parseFilters(params('status=NOPE&source=x&page=-4&stuck=yes'))).toEqual(DEFAULT_FILTERS);
  });
});

describe('phone helpers', () => {
  it('builds links from 10 digits', () => {
    expect(whatsappUrl('9876543210')).toBe('https://wa.me/919876543210');
    expect(telUrl('9876543210')).toBe('tel:+919876543210');
    expect(formatPhone('9876543210')).toBe('98765 43210');
  });
});

describe('lead permissions', () => {
  it('office can add but not act', () => {
    const p = leadPermissions('OFFICE');
    expect(p.add).toBe(true);
    expect(p.changeStatus).toBe(false);
    expect(p.edit).toBe(false);
  });
  it('only admin assigns', () => {
    expect(leadPermissions('ADMIN').assign).toBe(true);
    expect(leadPermissions('SALES').assign).toBe(false);
  });
});

describe('the row actions', () => {
  it('Admin: status, assign, proposal; Sales: status, proposal; Office: none', () => {
    expect(leadRowActions(leadPermissions('ADMIN'), 'NEW')).toEqual(['status', 'assign', 'proposal']);
    expect(leadRowActions(leadPermissions('SALES'), 'NEW')).toEqual(['status', 'proposal']);
    expect(leadRowActions(leadPermissions('OFFICE'), 'NEW')).toEqual([]);
  });

  it('a won lead cannot change status any more', () => {
    expect(leadRowActions(leadPermissions('ADMIN'), 'WON')).toEqual(['assign', 'proposal']);
  });
});
