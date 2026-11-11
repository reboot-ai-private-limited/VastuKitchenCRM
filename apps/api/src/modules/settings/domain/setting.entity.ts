import type { SettingKey } from '@vastu/contracts';

export interface SettingDefinition {
  group: 'Projects' | 'Leads' | 'Reminders' | 'Proposals' | 'Company';
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'text' | 'longText';
  /** What applies until an Admin changes it. */
  default: boolean | number | string;
  min?: number;
  max?: number;
  /** Numbers only: must be a whole number. */
  integer?: boolean;
  /** Text only. */
  maxLength?: number;
}

export type SettingRegistry = Record<SettingKey, SettingDefinition>;

/** A value an Admin saved. Only changes are stored; everything else is the registry default. */
export interface StoredSetting {
  key: SettingKey;
  value: boolean | number | string;
  updatedById: string | null;
  updatedAt: Date;
}
