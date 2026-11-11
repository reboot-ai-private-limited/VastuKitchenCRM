import { SETTING_GROUPS, type SettingDto } from '@vastu/contracts';

/** What the person has typed so far, per setting. Numbers stay strings while typing. */
export type Draft = Record<string, string | boolean>;
export type SettingValue = string | number | boolean;

/** "days" for the time settings, "MB" for file size; the API has no unit field, so read it off the key. */
export function unitOf(s: Pick<SettingDto, 'key' | 'type'>): string | null {
  if (s.type !== 'number') return null;
  if (/Days$/.test(s.key)) return 'days';
  if (/Mb$/.test(s.key)) return 'MB';
  return null;
}

/** Settings grouped in the order the API documents (Projects, Leads, …), keeping API order within a group. */
export function groupSettings(
  list: SettingDto[],
): Array<{ group: (typeof SETTING_GROUPS)[number]; items: SettingDto[] }> {
  return SETTING_GROUPS.map((group) => ({
    group,
    items: list.filter((s) => s.group === group),
  })).filter((g) => g.items.length > 0);
}

/** The editable form of a stored value. */
export const toDraftValue = (v: SettingValue): string | boolean =>
  typeof v === 'boolean' ? v : String(v);

/** The value the field shows: the draft if there is one, else what is saved. */
export const currentFieldValue = (s: SettingDto, draft: Draft): string | boolean =>
  s.key in draft ? draft[s.key]! : toDraftValue(s.value);

/** A draft entry back to the API's type, or null if a number is not a number. */
export function parseDraft(
  s: Pick<SettingDto, 'type'>,
  raw: string | boolean,
): SettingValue | null {
  if (s.type === 'boolean') return typeof raw === 'boolean' ? raw : raw === 'true';
  if (s.type === 'number') {
    const text = String(raw).trim().replace(/,/g, '');
    if (text === '') return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }
  return String(raw);
}

/** Only what actually changed, typed for the API. Unparseable numbers are left out (validation reports them). */
export function changedValues(list: SettingDto[], draft: Draft): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = {};
  for (const s of list) {
    if (!(s.key in draft)) continue;
    const next = parseDraft(s, draft[s.key]!);
    if (next !== null && next !== s.value) out[s.key] = next;
  }
  return out;
}

/** A message for the field, or null if it is fine. The API still decides; this saves a round trip. */
export function validateField(s: SettingDto, raw: string | boolean): string | null {
  if (s.type === 'number') {
    const n = parseDraft(s, raw);
    if (n === null) return 'Enter a number.';
    if (typeof n === 'number' && s.min !== null && n < s.min) return `Must be at least ${s.min}.`;
    if (typeof n === 'number' && s.max !== null && n > s.max) return `Must be at most ${s.max}.`;
    return null;
  }
  if ((s.type === 'text' || s.type === 'longText') && String(raw).trim() === '')
    return 'This can’t be empty.';
  return null;
}

/** Every client-side problem in the draft, keyed by setting key (only for fields that were edited). */
export function validateDraft(list: SettingDto[], draft: Draft): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of list) {
    if (!(s.key in draft)) continue;
    const msg = validateField(s, draft[s.key]!);
    if (msg) out[s.key] = msg;
  }
  return out;
}

/**
 * The API names a bad field as `values.<key>` in `data[].path`; `ApiError.fieldErrors` joins that path
 * with dots, and keys contain dots too, so strip the `values.` prefix and keep the rest as the key.
 */
export function settingErrorsFromApi(fieldErrors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, message] of Object.entries(fieldErrors)) {
    if (path.startsWith('values.')) out[path.slice('values.'.length)] ||= message;
  }
  return out;
}

/** "≈ 17 min" under very small day values (used in demos); null when the number is ordinary. */
export function approxDuration(days: number): string | null {
  if (!Number.isFinite(days) || days <= 0 || days >= 1) return null;
  const seconds = days * 86_400;
  if (seconds < 90) return `≈ ${Math.max(1, Math.round(seconds))} sec`;
  const minutes = seconds / 60;
  if (minutes < 90) return `≈ ${Math.round(minutes)} min`;
  return `≈ ${Math.round(minutes / 60)} h`;
}

/** The default, as text, for the "Default: …" line. */
export function formatDefault(s: Pick<SettingDto, 'default' | 'type'>): string {
  if (s.type === 'boolean') return s.default ? 'On' : 'Off';
  const text = String(s.default);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
