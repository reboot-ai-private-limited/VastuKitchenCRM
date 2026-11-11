import { SETTING_KEYS, type SettingDto, type SettingKey } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { SettingRegistry } from '../../domain/setting.entity.js';
import { assertValid, effective, normalise } from '../../domain/setting.rules.js';
import type { SettingRepositoryPort } from '../../domain/setting.repository.port.js';
import type { SettingsReader } from '../services/settingsReader.js';

export class ListSettingsUseCase {
  constructor(
    private readonly reader: SettingsReader,
    private readonly registry: SettingRegistry,
  ) {}

  async execute(): Promise<SettingDto[]> {
    const stored = await this.reader.stored();
    return SETTING_KEYS.map((key) => {
      const def = this.registry[key];
      const saved = stored.get(key);
      const value = effective(def, saved?.value);
      return {
        key,
        group: def.group,
        label: def.label,
        description: def.description,
        type: def.type,
        value,
        default: def.default,
        isDefault: saved === undefined || value === def.default,
        min: def.min ?? null,
        max: def.max ?? null,
        updatedAt: saved ? saved.updatedAt.toISOString() : null,
        updatedById: saved ? saved.updatedById : null,
      };
    });
  }
}

export class UpdateSettingsUseCase {
  constructor(
    private readonly repo: SettingRepositoryPort,
    private readonly reader: SettingsReader,
    private readonly registry: SettingRegistry,
    private readonly list: ListSettingsUseCase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Checks EVERY value first, then saves them together: a bad value saves nothing. */
  async execute(actorId: string, values: Record<string, unknown>): Promise<SettingDto[]> {
    const entries: Array<{ key: SettingKey; value: boolean | number | string }> = [];
    for (const [key, raw] of Object.entries(values)) {
      if (!SETTING_KEYS.includes(key as SettingKey)) {
        throw AppError.badRequest('Some settings are not valid.', [
          { path: ['values', key], message: 'Unknown setting' },
        ]);
      }
      const def = this.registry[key as SettingKey];
      assertValid(key, def, raw);
      entries.push({ key: key as SettingKey, value: normalise(def, raw) });
    }

    await this.repo.setMany(entries, actorId, this.now());
    this.reader.invalidate();
    return this.list.execute();
  }
}

export class ResetSettingUseCase {
  constructor(
    private readonly repo: SettingRepositoryPort,
    private readonly reader: SettingsReader,
    private readonly list: ListSettingsUseCase,
  ) {}

  /** Back to the default. Resetting something never changed is fine (nothing to do). */
  async execute(key: string): Promise<SettingDto[]> {
    if (!SETTING_KEYS.includes(key as SettingKey)) throw AppError.notFound('Unknown setting.');
    await this.repo.remove(key as SettingKey);
    this.reader.invalidate();
    return this.list.execute();
  }
}
