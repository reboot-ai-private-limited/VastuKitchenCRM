import { describe, expect, it } from 'vitest';
import {
  addDays,
  businessDate,
  formatDay,
  formatDuration,
  formatINR,
  formatINRShort,
  formatTime,
  initials,
  relativeAge,
} from './format';

describe('money', () => {
  it('uses Indian grouping', () => {
    expect(formatINR(1250000)).toBe('₹12,50,000');
    expect(formatINR(45000)).toBe('₹45,000');
    expect(formatINR(0)).toBe('₹0');
  });

  it('shortens lakhs and crores for tight spaces', () => {
    expect(formatINRShort(9_000_000)).toBe('₹90 L');
    expect(formatINRShort(15_500_000)).toBe('₹1.6 Cr'); // 1.55 → one decimal
    expect(formatINRShort(15_000_000)).toBe('₹1.5 Cr');
    expect(formatINRShort(100_000)).toBe('₹1 L');
    expect(formatINRShort(99_999)).toBe('₹99,999');
    expect(formatINRShort(0)).toBe('₹0');
  });
});

describe('business time (Asia/Kolkata, not the browser)', () => {
  it('shows an instant as IST wall-clock time', () => {
    expect(formatTime('2026-11-11T03:35:00Z')).toBe('9:05 AM');
    expect(formatTime('2026-11-11T12:30:00Z')).toBe('6:00 PM');
  });

  it('puts a late-evening UTC instant on the next business day', () => {
    // 19:00 UTC on the 10th is 00:30 on the 11th in Siliguri
    expect(businessDate('2026-11-10T19:00:00Z')).toBe('2026-11-11');
    expect(businessDate('2026-11-11T10:00:00Z')).toBe('2026-11-11');
  });

  it('does calendar arithmetic on date strings', () => {
    expect(addDays('2026-11-11', -6)).toBe('2026-11-05');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(formatDay('2026-11-11')).toBe('11 Nov 2026');
  });
});

describe('small helpers', () => {
  it('says how long ago', () => {
    const now = new Date('2026-11-11T10:00:00Z');
    expect(relativeAge('2026-11-11T09:59:40Z', now)).toBe('just now');
    expect(relativeAge('2026-11-11T09:30:00Z', now)).toBe('30 min ago');
    expect(relativeAge('2026-11-11T07:00:00Z', now)).toBe('3 h ago');
    expect(relativeAge('2026-11-09T10:00:00Z', now)).toBe('2 days ago');
    expect(relativeAge('2026-11-10T10:00:00Z', now)).toBe('1 day ago');
    expect(relativeAge('2026-10-01T10:00:00Z', now)).toBe('1 Oct 2026');
  });

  it('formats talk time and initials', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(420)).toBe('7 min');
    expect(formatDuration(4800)).toBe('1 h 20 min');
    expect(initials('Ravi Sharma')).toBe('RS');
    expect(initials('Owner')).toBe('O');
    expect(initials('  anil  kumar  gurung ')).toBe('AG');
  });
});
