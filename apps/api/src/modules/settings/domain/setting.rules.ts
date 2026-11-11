import { AppError } from '@/shared/errors/AppError.js';
import type { SettingDefinition } from './setting.entity.js';

/** Why `raw` is not acceptable for this setting, or null if it is fine. */
export function problemWith(def: SettingDefinition, raw: unknown): string | null {
  switch (def.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? null : 'Must be on or off';
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'Must be a number';
      if (def.integer && !Number.isInteger(raw)) return 'Must be a whole number';
      if (def.min !== undefined && raw < def.min) return `Must be at least ${def.min}`;
      if (def.max !== undefined && raw > def.max) return `Must be at most ${def.max}`;
      return null;
    }
    case 'text':
    case 'longText': {
      if (typeof raw !== 'string') return 'Must be text';
      const text = raw.trim();
      if (text.length === 0) return 'Must not be empty';
      const max = def.maxLength ?? (def.type === 'text' ? 200 : 5000);
      return text.length > max ? `At most ${max} characters` : null;
    }
  }
}

/** The value to store: text is trimmed, so a stray space never reaches a printed proposal. */
export function normalise(def: SettingDefinition, raw: unknown): boolean | number | string {
  return typeof raw === 'string' ? raw.trim() : (raw as boolean | number);
}

/**
 * What applies for a stored value: the value itself, or the default when what is stored no longer
 * passes the rules (e.g. a limit was tightened in a later release). A bad stored value must never
 * take a feature down.
 */
export function effective(def: SettingDefinition, stored: unknown): boolean | number | string {
  return stored !== undefined && problemWith(def, stored) === null
    ? (stored as boolean | number | string)
    : def.default;
}

export function assertValid(key: string, def: SettingDefinition, raw: unknown): void {
  const problem = problemWith(def, raw);
  if (problem) {
    throw AppError.badRequest('Some settings are not valid.', [
      { path: ['values', key], message: problem },
    ]);
  }
}
