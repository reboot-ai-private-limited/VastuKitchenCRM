import { createLeadBodySchema, phoneSchema, type ImportLeadsBodyDto } from '@vastu/contracts';

/** RFC 4180 CSV → rows of cells. Handles quotes, "" escapes, CRLF, a BOM, and newlines inside quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Blank lines (a lone empty cell) are not data.
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export type ImportRow = ImportLeadsBodyDto['rows'][number];
type Field = keyof ImportRow;

/** Header spellings people actually use → the API's field. Compared lower-cased, without spaces or punctuation. */
const ALIASES: Record<Field, string[]> = {
  name: ['name', 'fullname', 'customername', 'leadname', 'customer'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'whatsapp'],
  altPhone: [
    'altphone',
    'alternatephone',
    'alternatenumber',
    'phone2',
    'secondaryphone',
    'altmobile',
  ],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
  city: ['city', 'town', 'location'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments', 'requirement'],
  source: ['source', 'leadsource', 'channel'],
};
const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface MappedCsv {
  /** Posted rows, in file order. */
  rows: ImportRow[];
  /** The 1-based line of each row in the file (header is line 1), for messages the person can find. */
  lines: number[];
  /** Original cells per row, for the "rejected rows" download. */
  raw: string[][];
  header: string[];
  /** Which file column feeds which field. */
  columns: Partial<Record<Field, string>>;
  /** Required fields the file has no column for. */
  missing: Field[];
  ignored: string[];
}

export function mapCsv(table: string[][]): MappedCsv {
  const header = (table[0] ?? []).map((h) => h.trim());
  const index = new Map<Field, number>();
  const used = new Set<number>();
  (Object.keys(ALIASES) as Field[]).forEach((field) => {
    const i = header.findIndex((h, n) => !used.has(n) && ALIASES[field].includes(norm(h)));
    if (i >= 0) {
      index.set(field, i);
      used.add(i);
    }
  });
  const body = table.slice(1);
  const rows: ImportRow[] = body.map((cells) => {
    const get = (f: Field) => {
      const i = index.get(f);
      return i === undefined ? undefined : (cells[i] ?? '').trim();
    };
    const row: ImportRow = { name: get('name') ?? '', phone: get('phone') ?? '' };
    for (const f of ['altPhone', 'email', 'city', 'notes', 'source'] as const) {
      const v = get(f);
      if (v) row[f] = v;
    }
    return row;
  });
  return {
    rows,
    lines: body.map((_, n) => n + 2),
    raw: body,
    header,
    columns: Object.fromEntries([...index].map(([f, i]) => [f, header[i]!])),
    missing: (['name', 'phone'] as const).filter((f) => !index.has(f)),
    ignored: header.filter((_, i) => !used.has(i) && header[i] !== ''),
  };
}

/** The same checks the API makes, so the preview can warn before anything is sent. The API stays the judge. */
export function previewProblems(row: ImportRow): string[] {
  const problems: string[] = [];
  if (!row.name.trim()) problems.push('Name is missing');
  if (!phoneSchema.safeParse(row.phone).success)
    problems.push('Phone must be a 10-digit mobile number');
  if (row.altPhone && !phoneSchema.safeParse(row.altPhone).success)
    problems.push('Alternate phone is not valid');
  if (row.email && !createLeadBodySchema.shape.email.safeParse(row.email).success)
    problems.push('Email is not valid');
  return problems;
}

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: string[][]): string =>
  rows.map((r) => r.map(cell).join(',')).join('\r\n');

export const TEMPLATE_CSV = toCsv([
  ['name', 'phone', 'alt phone', 'email', 'city', 'source', 'notes'],
  [
    'Rahul Sharma',
    '9876543210',
    '',
    'rahul@example.com',
    'Siliguri',
    'Justdial',
    'Wants an L-shaped kitchen',
  ],
]);

/** The API reports `field: message` in schema language; say it the way the person would. */
export function friendlyImportError(e: string): string {
  const field = e.split(':')[0]?.trim();
  if (field === 'name') return 'Name is missing';
  if (field === 'phone') return 'Phone must be a 10-digit mobile number';
  if (field === 'altPhone') return 'Alternate phone is not valid';
  if (field === 'email') return 'Email is not valid';
  if (field === 'city' || field === 'notes')
    return `${field === 'city' ? 'City' : 'Notes'} is too long or empty`;
  return e;
}
