import { describe, expect, it } from 'vitest';
import type { DashboardPersonDto } from '@vastu/contracts';
import { clampRange, daysIn, presets } from './range-picker';
import { sortPeople } from './people';

const person = (
  name: string,
  calls: number,
  lastAt: string | null,
  inAt: string | null = null,
): DashboardPersonDto => ({
  userId: name,
  name,
  designation: null,
  attendance: { daysPresent: inAt ? 1 : 0, inAt, outAt: null },
  activity: {
    firstAt: null,
    lastAt,
    calls,
    answeredCalls: 0,
    talkSeconds: 0,
    leadsHandled: 0,
    proposalsGenerated: 0,
    proposalsSent: 0,
    posts: 0,
    comments: 0,
  },
});

describe('the date range', () => {
  it('offers Today, 7 days and 30 days ending today', () => {
    const [today, week, month] = presets('2026-11-11');
    expect([today?.from, today?.to]).toEqual(['2026-11-11', '2026-11-11']);
    expect([week?.from, week?.to]).toEqual(['2026-11-05', '2026-11-11']);
    expect(daysIn({ from: month!.from, to: month!.to })).toBe(30);
  });

  it('keeps a hand-picked range valid: not backwards, at most 31 days', () => {
    expect(clampRange({ from: '2026-11-10', to: '2026-11-05' }, 'from')).toEqual({
      from: '2026-11-10',
      to: '2026-11-10',
    });
    expect(clampRange({ from: '2026-11-10', to: '2026-11-05' }, 'to')).toEqual({
      from: '2026-11-05',
      to: '2026-11-05',
    });
    expect(daysIn(clampRange({ from: '2026-09-01', to: '2026-11-05' }, 'from'))).toBe(31);
    expect(clampRange({ from: '2026-09-01', to: '2026-11-05' }, 'to')).toEqual({
      from: '2026-10-06',
      to: '2026-11-05',
    });
    expect(clampRange({ from: '2026-11-01', to: '2026-11-07' }, 'to')).toEqual({
      from: '2026-11-01',
      to: '2026-11-07',
    });
  });
});

describe('sorting staff activity', () => {
  const people = [
    person('Rita', 0, null),
    person('Ravi', 9, '2026-11-11T10:00:00Z'),
    person('Anil', 4, '2026-11-11T08:00:00Z'),
    person('Bimal', 0, null),
  ];
  const names = (rows: DashboardPersonDto[]) => rows.map((p) => p.name);

  it('by name', () => {
    expect(names(sortPeople(people, 'name', 'asc'))).toEqual(['Anil', 'Bimal', 'Ravi', 'Rita']);
    expect(names(sortPeople(people, 'name', 'desc'))).toEqual(['Rita', 'Ravi', 'Bimal', 'Anil']);
  });

  it('by calls, busiest first, and people with none always last', () => {
    expect(names(sortPeople(people, 'calls', 'desc'))).toEqual(['Ravi', 'Anil', 'Bimal', 'Rita']);
    expect(names(sortPeople(people, 'calls', 'asc'))).toEqual(['Anil', 'Ravi', 'Bimal', 'Rita']);
  });

  it('by last activity, with nobody-active at the bottom either way', () => {
    expect(names(sortPeople(people, 'last', 'desc'))).toEqual(['Ravi', 'Anil', 'Bimal', 'Rita']);
    expect(names(sortPeople(people, 'last', 'asc'))).toEqual(['Anil', 'Ravi', 'Bimal', 'Rita']);
  });

  it('does not change the original list', () => {
    const copy = [...people];
    sortPeople(people, 'calls', 'desc');
    expect(people).toEqual(copy);
  });
});
