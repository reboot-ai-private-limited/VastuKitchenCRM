import type { SettingKey, SettingValue } from '@vastu/contracts';

/**
 * The only thing another module may import from `settings/`. Typed by key: a boolean setting
 * returns a boolean. Always returns a usable value (the default when nothing is saved).
 */
export interface SettingsPublicContract {
  get<K extends SettingKey>(key: K): Promise<SettingValue<K>>;
}
