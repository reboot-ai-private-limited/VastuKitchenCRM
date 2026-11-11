import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPLAINT_FILTERS,
  canRaiseComplaint,
  complaintFiltersToSearch,
  describeComplaintEvent,
  parseComplaintFilters,
  snippet,
} from './complaints';

describe('complaint filters in the URL', () => {
  it('round-trips, omits defaults and ignores junk', () => {
    const f = { status: 'ASSIGNED' as const, mine: true, projectId: 'p1', page: 2 };
    expect(
      parseComplaintFilters(new URLSearchParams(complaintFiltersToSearch(f).slice(1))),
    ).toEqual(f);
    expect(complaintFiltersToSearch(DEFAULT_COMPLAINT_FILTERS)).toBe('');
    expect(parseComplaintFilters(new URLSearchParams('status=NOPE&page=0&mine=yes'))).toEqual(
      DEFAULT_COMPLAINT_FILTERS,
    );
  });
});

describe('canRaiseComplaint', () => {
  it('excludes technicians and HR', () => {
    expect(canRaiseComplaint('TECHNICIAN')).toBe(false);
    expect(canRaiseComplaint('HR')).toBe(false);
    expect(canRaiseComplaint('CUSTOMER')).toBe(true);
    expect(canRaiseComplaint('OFFICE')).toBe(true);
  });
});

describe('snippet', () => {
  it('collapses whitespace and truncates', () => {
    expect(snippet('a\n\n b', 10)).toBe('a b');
    expect(snippet('x'.repeat(100), 10)).toBe(`${'x'.repeat(10)}…`);
  });
});

describe('describeComplaintEvent', () => {
  it('words each event', () => {
    const at = '2026-01-01T00:00:00Z';
    const actor = { id: 'u', name: 'Ravi' };
    expect(
      describeComplaintEvent({
        type: 'ASSIGNED',
        at,
        actor,
        note: null,
        assignee: { id: 't', name: 'Tarun' },
      }).title,
    ).toBe('Assigned to Tarun');
    expect(
      describeComplaintEvent({ type: 'REOPENED', at, actor, note: 'still leaks', assignee: null })
        .note,
    ).toBe('Reason: still leaks');
    expect(
      describeComplaintEvent({ type: 'RESOLVED', at, actor: null, note: 'fixed', assignee: null }),
    ).toEqual({ title: 'Resolved by Someone', note: 'fixed' });
  });
});
