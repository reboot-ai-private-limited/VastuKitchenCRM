import { describe, expect, it } from 'vitest';
import {
  datesOfMonth,
  isMonth,
  isWeeklyOff,
  parseWeeklyOff,
  workingDatesOf,
  type OffRule,
} from './weeklyOff.js';

const rules = (text: string): OffRule[] => {
  const p = parseWeeklyOff(text);
  if (!p.ok) throw new Error(p.problem);
  return p.rules;
};

describe('parsing', () => {
  it('reads every Sunday, nth weekdays, and several rules', () => {
    expect(rules('SUN')).toEqual([{ weekday: 'SUN', weeks: [] }]);
    expect(rules('sat:1,3')).toEqual([{ weekday: 'SAT', weeks: [1, 3] }]);
    expect(rules(' SUN ; THU : 2 ')).toEqual([
      { weekday: 'SUN', weeks: [] },
      { weekday: 'THU', weeks: [2] },
    ]);
    expect(rules('SAT:3,1,3')).toEqual([{ weekday: 'SAT', weeks: [1, 3] }]);
  });

  it('refuses nonsense with a hint', () => {
    for (const bad of [
      '',
      ';',
      'SUNDAY',
      'FOO',
      'SAT:0',
      'SAT:6',
      'SAT:x',
      'SAT:',
      'SUN SAT',
      '1st Saturday',
    ])
      expect(parseWeeklyOff(bad)).toMatchObject({ ok: false });
    const p = parseWeeklyOff('SAT:9');
    expect(p.ok === false && p.problem).toContain('1 to 5');
  });
});

describe('which dates are off (November 2026 starts on a Sunday)', () => {
  it('every Sunday', () => {
    const r = rules('SUN');
    expect(['2026-11-01', '2026-11-08', '2026-11-29'].every((d) => isWeeklyOff(d, r))).toBe(true);
    expect(isWeeklyOff('2026-11-02', r)).toBe(false);
  });

  it('1st and 3rd Saturday only', () => {
    const r = rules('SAT:1,3');
    // Saturdays in Nov 2026: 7, 14, 21, 28
    expect(isWeeklyOff('2026-11-07', r)).toBe(true); // 1st
    expect(isWeeklyOff('2026-11-14', r)).toBe(false); // 2nd
    expect(isWeeklyOff('2026-11-21', r)).toBe(true); // 3rd
    expect(isWeeklyOff('2026-11-28', r)).toBe(false); // 4th
  });

  it('the 2nd Thursday, and a 5th that only some months have', () => {
    expect(isWeeklyOff('2026-11-12', rules('THU:2'))).toBe(true);
    expect(isWeeklyOff('2026-11-05', rules('THU:2'))).toBe(false);
    // Nov 2026 has five Sundays (1, 8, 15, 22, 29); Dec 2026 has four (6, 13, 20, 27).
    expect(isWeeklyOff('2026-11-29', rules('SUN:5'))).toBe(true);
    expect(datesOfMonth('2026-12').filter((d) => isWeeklyOff(d, rules('SUN:5')))).toEqual([]);
  });
});

describe('working days of a month', () => {
  it('counts the calendar minus the off days', () => {
    expect(datesOfMonth('2026-11')).toHaveLength(30);
    expect(datesOfMonth('2028-02')).toHaveLength(29); // leap year
    expect(workingDatesOf('2026-11', rules('SUN'))).toHaveLength(25); // 5 Sundays
    expect(workingDatesOf('2026-11', rules('SUN; SAT:1,3'))).toHaveLength(23);
    expect(workingDatesOf('2026-12', rules('SUN'))).toHaveLength(27); // 4 Sundays
  });

  it('validates a month string', () => {
    expect(isMonth('2026-11')).toBe(true);
    for (const bad of ['2026-13', '2026-00', '26-11', '2026-1', '2026-11-01'])
      expect(isMonth(bad)).toBe(false);
  });
});
