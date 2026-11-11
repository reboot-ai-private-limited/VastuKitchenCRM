import { z } from 'zod';

/**
 * System settings: values the Admin can change without a developer or a redeploy. This map is the
 * single list of keys and their types; the API's registry adds labels, defaults and limits, and
 * `getSetting` calls are typed from it (a boolean key returns a boolean, and so on).
 */
export const SETTING_TYPES = {
  'projects.autoCreateOnWon': 'boolean',
  'leads.stuckDays': 'number',
  'reminders.unseenDays': 'number',
  'reminders.noActionDays': 'number',
  'reminders.stagnantMax': 'number',
  'proposals.defaultTerms': 'longText',
  'company.name': 'text',
  'company.tagline': 'text',
  'company.address': 'longText',
  'company.phone': 'text',
} as const;

export type SettingKey = keyof typeof SETTING_TYPES;
export const SETTING_KEYS = Object.keys(SETTING_TYPES) as SettingKey[];

interface TypeMap {
  boolean: boolean;
  number: number;
  text: string;
  longText: string;
}
/** The value type of one setting: `SettingValue<'leads.stuckDays'>` is `number`. */
export type SettingValue<K extends SettingKey> = TypeMap[(typeof SETTING_TYPES)[K]];

export const SETTING_GROUPS = ['Projects', 'Leads', 'Reminders', 'Proposals', 'Company'] as const;

const settingValueSchema = z.union([z.boolean(), z.number(), z.string()]);

export const settingSchema = z.object({
  key: z.string(),
  group: z.enum(SETTING_GROUPS),
  label: z.string(),
  description: z.string(),
  type: z.enum(['boolean', 'number', 'text', 'longText']),
  /** What is in effect now. */
  value: settingValueSchema,
  /** What it is when nobody has changed it. */
  default: settingValueSchema,
  /** True when `value` is the default (nothing is saved for this key). */
  isDefault: z.boolean(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  updatedAt: z.string().nullable(),
  updatedById: z.string().nullable(),
});
export type SettingDto = z.infer<typeof settingSchema>;

/** Several settings at once, saved all-or-nothing. Values are checked against each setting's own rules. */
export const updateSettingsBodySchema = z.object({
  values: z.record(settingValueSchema).refine((v) => Object.keys(v).length > 0, 'Nothing to save'),
});
export type UpdateSettingsBodyDto = z.infer<typeof updateSettingsBodySchema>;

export const settingKeyParamsSchema = z.object({ key: z.string().min(1) });
