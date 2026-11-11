import { describe, expect, it } from 'vitest';
import { addDays, atLocalTime, todayIn } from './businessDate.js';

describe('business dates', () => {
  it('uses the business timezone, not UTC', () => {
    // 20:00 UTC on the 14th is already 01:30 on the 15th in India (UTC+5:30)…
    const late = new Date('2026-11-14T20:00:00Z');
    expect(todayIn('Asia/Kolkata', late)).toBe('2026-11-15');
    expect(todayIn('UTC', late)).toBe('2026-11-14');
    // …and 18:00 UTC is 23:30 on the 14th there: still the 14th.
    expect(todayIn('Asia/Kolkata', new Date('2026-11-14T18:00:00Z'))).toBe('2026-11-14');
  });

  it('moves dates across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compares as plain strings', () => {
    expect('2026-11-09' < '2026-11-14').toBe(true);
  });
});

describe('atLocalTime', () => {
  it('turns local clock time in the business timezone into the right instant', () => {
    // Siliguri is UTC+5:30 all year.
    expect(atLocalTime('Asia/Kolkata', '2026-11-03', '09:05').toISOString()).toBe(
      '2026-11-03T03:35:00.000Z',
    );
    expect(atLocalTime('Asia/Kolkata', '2026-11-03', '00:10').toISOString()).toBe(
      '2026-11-02T18:40:00.000Z',
    );
    expect(atLocalTime('UTC', '2026-11-03', '18:00').toISOString()).toBe(
      '2026-11-03T18:00:00.000Z',
    );
    // and it round-trips with todayIn
    expect(todayIn('Asia/Kolkata', atLocalTime('Asia/Kolkata', '2026-11-03', '23:59'))).toBe(
      '2026-11-03',
    );
  });
});
