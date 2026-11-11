import { describe, expect, it } from 'vitest';
import type { SettingKey } from '@vastu/contracts';
import type { SettingRegistry, StoredSetting } from '../../domain/setting.entity.js';
import type { SettingRepositoryPort } from '../../domain/setting.repository.port.js';
import { SettingsReader } from '../services/settingsReader.js';
import {
  ListSettingsUseCase,
  ResetSettingUseCase,
  UpdateSettingsUseCase,
} from './settings.usecases.js';

/** A small registry covering every type and rule; the real one is just more lines of the same. */
const REGISTRY: SettingRegistry = {
  'projects.autoCreateOnWon': {
    group: 'Projects',
    label: 'Auto',
    description: 'd',
    type: 'boolean',
    default: true,
  },
  'leads.stuckDays': {
    group: 'Leads',
    label: 'Stuck',
    description: 'd',
    type: 'number',
    default: 2,
    min: 0.5,
    max: 30,
  },
  'reminders.unseenDays': {
    group: 'Reminders',
    label: 'U',
    description: 'd',
    type: 'number',
    default: 2,
    min: 0.5,
    max: 30,
  },
  'reminders.complaintDays': {
    group: 'Reminders',
    label: 'C',
    description: 'd',
    type: 'number',
    default: 3,
    min: 0.5,
    max: 30,
  },
  'hr.weeklyOff': {
    group: 'HR',
    label: 'Off',
    description: 'd',
    type: 'text',
    default: 'SUN',
    maxLength: 100,
    check: (text) => (text.startsWith('SUN') ? null : 'Must start with SUN'),
  },
  'reminders.noActionDays': {
    group: 'Reminders',
    label: 'N',
    description: 'd',
    type: 'number',
    default: 2,
    min: 0.5,
    max: 30,
  },
  'reminders.stagnantMax': {
    group: 'Reminders',
    label: 'M',
    description: 'd',
    type: 'number',
    default: 3,
    min: 1,
    max: 20,
    integer: true,
  },
  'docs.maxFileMb': {
    group: 'Documents',
    label: 'D',
    description: 'd',
    type: 'number',
    default: 10,
    min: 1,
    max: 100,
    integer: true,
  },
  'proposals.defaultTerms': {
    group: 'Proposals',
    label: 'T',
    description: 'd',
    type: 'longText',
    default: 'DEFAULT TERMS',
  },
  'company.name': {
    group: 'Company',
    label: 'Name',
    description: 'd',
    type: 'text',
    default: 'Vaastu Kitchen',
    maxLength: 10,
  },
  'company.tagline': {
    group: 'Company',
    label: 'Tag',
    description: 'd',
    type: 'text',
    default: 'Tag',
  },
  'company.address': {
    group: 'Company',
    label: 'Addr',
    description: 'd',
    type: 'longText',
    default: 'Siliguri',
  },
  'company.phone': {
    group: 'Company',
    label: 'Ph',
    description: 'd',
    type: 'text',
    default: '+91 1',
  },
};

class FakeRepo implements SettingRepositoryPort {
  rows = new Map<SettingKey, StoredSetting>();
  reads = 0;
  async findAll() {
    this.reads++;
    return [...this.rows.values()];
  }
  async setMany(
    entries: Array<{ key: SettingKey; value: boolean | number | string }>,
    by: string,
    at: Date,
  ) {
    for (const e of entries)
      this.rows.set(e.key, { key: e.key, value: e.value, updatedById: by, updatedAt: at });
  }
  async remove(key: SettingKey) {
    return this.rows.delete(key);
  }
}

function setup(ttlMs = 30_000) {
  let clock = 0;
  const repo = new FakeRepo();
  const reader = new SettingsReader(repo, REGISTRY, ttlMs, () => clock);
  const list = new ListSettingsUseCase(reader, REGISTRY);
  const update = new UpdateSettingsUseCase(
    repo,
    reader,
    REGISTRY,
    list,
    () => new Date('2026-11-11T10:00:00Z'),
  );
  const reset = new ResetSettingUseCase(repo, reader, list);
  return { repo, reader, list, update, reset, tick: (ms: number) => (clock += ms) };
}
const detail = (e: unknown) =>
  (e as { publicDetails?: Array<{ path: string[]; message: string }> }).publicDetails;

describe('reading', () => {
  it('returns the default until an Admin changes it, then the saved value', async () => {
    const { reader, update } = setup();
    expect(await reader.get('projects.autoCreateOnWon')).toBe(true);
    expect(await reader.get('leads.stuckDays')).toBe(2);
    await update.execute('admin1', { 'projects.autoCreateOnWon': false, 'leads.stuckDays': 5 });
    expect(await reader.get('projects.autoCreateOnWon')).toBe(false); // the cache was cleared by the save
    expect(await reader.get('leads.stuckDays')).toBe(5);
  });

  it('caches reads (hot paths) but forgets on a save, and again after the time limit', async () => {
    const { repo, reader, update, tick } = setup(1000);
    await reader.get('leads.stuckDays');
    await reader.get('company.name');
    await reader.get('company.phone');
    expect(repo.reads).toBe(1); // three reads, one trip to the database

    await update.execute('admin1', { 'leads.stuckDays': 3 });
    await reader.get('leads.stuckDays');
    expect(repo.reads).toBe(2); // the save cleared it

    tick(1500); // another server saved meanwhile: the cache expires on its own
    repo.rows.set('company.name', {
      key: 'company.name',
      value: 'Other',
      updatedById: null,
      updatedAt: new Date(),
    });
    expect(await reader.get('company.name')).toBe('Other');
  });

  it('falls back to the default when what is stored no longer passes the rules, or the key is gone', async () => {
    const { repo, reader } = setup();
    repo.rows.set('leads.stuckDays', {
      key: 'leads.stuckDays',
      value: 9999,
      updatedById: null,
      updatedAt: new Date(),
    }); // above max
    repo.rows.set('projects.autoCreateOnWon', {
      key: 'projects.autoCreateOnWon',
      value: 'yes' as never,
      updatedById: null,
      updatedAt: new Date(),
    });
    repo.rows.set('removed.setting' as SettingKey, {
      key: 'removed.setting' as SettingKey,
      value: 1,
      updatedById: null,
      updatedAt: new Date(),
    });
    expect(await reader.get('leads.stuckDays')).toBe(2);
    expect(await reader.get('projects.autoCreateOnWon')).toBe(true);
  });
});

describe('listing', () => {
  it('describes every setting, and says which are still at their default', async () => {
    const { list, update } = setup();
    await update.execute('admin1', { 'leads.stuckDays': 5, 'company.name': 'Vaastu' });
    const all = await list.execute();
    expect(all).toHaveLength(13);
    const byKey = Object.fromEntries(all.map((s) => [s.key, s]));
    expect(byKey['leads.stuckDays']).toMatchObject({
      value: 5,
      default: 2,
      isDefault: false,
      min: 0.5,
      max: 30,
      group: 'Leads',
      updatedById: 'admin1',
    });
    expect(byKey['projects.autoCreateOnWon']).toMatchObject({
      value: true,
      isDefault: true,
      updatedAt: null,
      updatedById: null,
    });
  });

  it('treats a value set equal to the default as default', async () => {
    const { list, update } = setup();
    await update.execute('admin1', { 'leads.stuckDays': 2 });
    expect((await list.execute()).find((s) => s.key === 'leads.stuckDays')?.isDefault).toBe(true);
  });
});

describe('saving', () => {
  it.each([
    ['leads.stuckDays', 'two', 'Must be a number'],
    ['leads.stuckDays', 0.1, 'Must be at least 0.5'],
    ['leads.stuckDays', 400, 'Must be at most 30'],
    ['reminders.stagnantMax', 2.5, 'Must be a whole number'],
    ['projects.autoCreateOnWon', 'false', 'Must be on or off'],
    ['company.name', '   ', 'Must not be empty'],
    ['company.name', 'A very long company name', 'At most 10 characters'],
    ['company.tagline', 5, 'Must be text'],
  ] as const)('refuses %s = %j (%s)', async (key, value, message) => {
    const { update } = setup();
    try {
      await update.execute('admin1', { [key]: value });
      throw new Error('should have been refused');
    } catch (e) {
      expect(detail(e)).toEqual([{ path: ['values', key], message }]);
    }
  });

  it('refuses an unknown key', async () => {
    const { update } = setup();
    await expect(update.execute('admin1', { 'nope.nothing': 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('saves nothing at all if any one value is invalid (all or nothing)', async () => {
    const { repo, update } = setup();
    await expect(
      update.execute('admin1', { 'leads.stuckDays': 5, 'projects.autoCreateOnWon': 'maybe' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.rows.size).toBe(0);
  });

  it('trims text, so a stray space never reaches a printed proposal', async () => {
    const { reader, update } = setup();
    await update.execute('admin1', { 'company.tagline': '  Modular Kitchens  ' });
    expect(await reader.get('company.tagline')).toBe('Modular Kitchens');
  });
});

describe('resetting', () => {
  it('puts the default back, and is harmless when nothing was saved', async () => {
    const { reader, update, reset } = setup();
    await update.execute('admin1', { 'leads.stuckDays': 9 });
    await reset.execute('leads.stuckDays');
    expect(await reader.get('leads.stuckDays')).toBe(2);
    await expect(reset.execute('leads.stuckDays')).resolves.toBeDefined();
    await expect(reset.execute('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('a text setting with its own rule (check)', () => {
  it("rejects a value the rule refuses, with the rule's message, and keeps the default", async () => {
    const { reader, update } = setup();
    const err = await update.execute('admin1', { 'hr.weeklyOff': 'MON' }).catch((e: unknown) => e);
    expect(detail(err)).toEqual([
      { path: ['values', 'hr.weeklyOff'], message: 'Must start with SUN' },
    ]);
    expect(await reader.get('hr.weeklyOff')).toBe('SUN');
    await update.execute('admin1', { 'hr.weeklyOff': 'SUN; SAT:1,3' });
    expect(await reader.get('hr.weeklyOff')).toBe('SUN; SAT:1,3');
  });
});
