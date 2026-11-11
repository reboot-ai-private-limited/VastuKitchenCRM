import type { SettingKey } from '@vastu/contracts';
import type { StoredSetting } from './setting.entity.js';

export interface SettingRepositoryPort {
  findAll(): Promise<StoredSetting[]>;
  /** Saves every entry (all-or-nothing is the caller's job: it validates everything first). */
  setMany(
    entries: Array<{ key: SettingKey; value: boolean | number | string }>,
    updatedById: string,
    at: Date,
  ): Promise<void>;
  /** Forgets the saved value, so the default applies again. False when nothing was saved. */
  remove(key: SettingKey): Promise<boolean>;
}
