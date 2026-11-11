import type { SettingDto } from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import {
  approxDuration,
  changedValues,
  groupSettings,
  parseDraft,
  settingErrorsFromApi,
  unitOf,
  validateDraft,
} from './settings';

const s = (over: Partial<SettingDto>): SettingDto => ({
  key: 'leads.stuckDays',
  group: 'Leads',
  label: 'Stuck',
  description: '',
  type: 'number',
  value: 2,
  default: 2,
  isDefault: true,
  min: 0.0001,
  max: 365,
  updatedAt: null,
  updatedById: null,
  ...over,
});
const list = [
  s({}),
  s({
    key: 'projects.autoCreateOnWon',
    group: 'Projects',
    type: 'boolean',
    value: true,
    default: true,
    min: null,
    max: null,
  }),
  s({
    key: 'company.name',
    group: 'Company',
    type: 'text',
    value: 'VK',
    default: 'VK',
    min: null,
    max: null,
  }),
  s({ key: 'docs.maxFileMb', group: 'Documents', value: 10, min: 1, max: 100 }),
];

describe('units and grouping', () => {
  it('reads units off the key', () => {
    expect(unitOf(list[0]!)).toBe('days');
    expect(unitOf(list[3]!)).toBe('MB');
    expect(unitOf(list[1]!)).toBeNull();
  });
  it('orders groups like the API documents them', () => {
    expect(groupSettings(list).map((g) => g.group)).toEqual([
      'Projects',
      'Leads',
      'Documents',
      'Company',
    ]);
  });
});

describe('changedValues', () => {
  it('returns only real changes, typed', () => {
    const draft = {
      'leads.stuckDays': '2',
      'projects.autoCreateOnWon': false,
      'company.name': 'VK',
      'docs.maxFileMb': '20',
    };
    expect(changedValues(list, draft)).toEqual({
      'projects.autoCreateOnWon': false,
      'docs.maxFileMb': 20,
    });
  });
  it('accepts decimals and skips unparseable numbers', () => {
    expect(changedValues(list, { 'leads.stuckDays': '0.0002' })).toEqual({
      'leads.stuckDays': 0.0002,
    });
    expect(changedValues(list, { 'leads.stuckDays': 'abc' })).toEqual({});
    expect(parseDraft({ type: 'number' }, '1,5')).toBe(15);
  });
});

describe('validateDraft', () => {
  it('enforces min and max and number-ness, only on edited fields', () => {
    expect(validateDraft(list, { 'docs.maxFileMb': '500' })).toEqual({
      'docs.maxFileMb': 'Must be at most 100.',
    });
    expect(validateDraft(list, { 'docs.maxFileMb': '0' })).toEqual({
      'docs.maxFileMb': 'Must be at least 1.',
    });
    expect(validateDraft(list, { 'leads.stuckDays': '' })).toEqual({
      'leads.stuckDays': 'Enter a number.',
    });
    expect(validateDraft(list, { 'company.name': '  ' })['company.name']).toMatch(/empty/);
    expect(validateDraft(list, {})).toEqual({});
  });
});

describe('settingErrorsFromApi', () => {
  it('strips the values. prefix and keeps dotted keys whole', () => {
    expect(
      settingErrorsFromApi({
        'values.leads.stuckDays': 'Too big',
        'values.hr.weeklyOff': 'Bad day',
        other: 'x',
      }),
    ).toEqual({
      'leads.stuckDays': 'Too big',
      'hr.weeklyOff': 'Bad day',
    });
  });
});

describe('approxDuration', () => {
  it('helps with tiny day values only', () => {
    expect(approxDuration(0.0002)).toBe('≈ 17 sec');
    expect(approxDuration(0.012)).toBe('≈ 17 min');
    expect(approxDuration(0.5)).toBe('≈ 12 h');
    expect(approxDuration(2)).toBeNull();
  });
});
