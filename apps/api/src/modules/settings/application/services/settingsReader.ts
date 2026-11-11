import { SETTING_KEYS, type SettingKey, type SettingValue } from '@vastu/contracts';
import type { SettingRegistry, StoredSetting } from '../../domain/setting.entity.js';
import { effective } from '../../domain/setting.rules.js';
import type { SettingRepositoryPort } from '../../domain/setting.repository.port.js';

/**
 * Reads settings through a short cache: values are read on hot paths (every lead list), and they
 * change rarely. A save clears the cache at once; the time limit only covers another server
 * instance that did the saving.
 */
export class SettingsReader {
  private cache: { loadedAt: number; stored: Map<SettingKey, StoredSetting> } | undefined;

  constructor(
    private readonly repo: SettingRepositoryPort,
    private readonly registry: SettingRegistry,
    private readonly ttlMs = 30_000,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async stored(): Promise<Map<SettingKey, StoredSetting>> {
    if (this.cache && this.clock() - this.cache.loadedAt < this.ttlMs) return this.cache.stored;
    const rows = await this.repo.findAll();
    // Rows for a key that no longer exists are ignored, never an error.
    const stored = new Map(rows.filter((r) => SETTING_KEYS.includes(r.key)).map((r) => [r.key, r]));
    this.cache = { loadedAt: this.clock(), stored };
    return stored;
  }

  invalidate(): void {
    this.cache = undefined;
  }

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const def = this.registry[key];
    return effective(def, (await this.stored()).get(key)?.value) as SettingValue<K>;
  }
}
