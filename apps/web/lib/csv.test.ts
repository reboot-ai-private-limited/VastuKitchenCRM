import { describe, expect, it } from 'vitest';
import { mapCsv, parseCsv, previewProblems, toCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, escapes, CRLF, BOM and embedded newlines', () => {
    const t = parseCsv('﻿name,notes\r\n"Rao, S","said ""call"" later\nsoon"\r\n\r\nAnil,\r\n');
    expect(t).toEqual([
      ['name', 'notes'],
      ['Rao, S', 'said "call" later\nsoon'],
      ['Anil', ''],
    ]);
  });
  it('round-trips through toCsv', () => {
    const rows = [
      ['a', 'b,c'],
      ['"q"', 'x\ny'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('mapCsv', () => {
  it('finds columns by common spellings and reports what is missing or ignored', () => {
    const m = mapCsv(
      parseCsv('Full Name,Mobile Number,Lead Source,Budget\nA B,98765 43210,justdial,5L'),
    );
    expect(m.columns).toEqual({ name: 'Full Name', phone: 'Mobile Number', source: 'Lead Source' });
    expect(m.rows).toEqual([{ name: 'A B', phone: '98765 43210', source: 'justdial' }]);
    expect(m.ignored).toEqual(['Budget']);
    expect(m.missing).toEqual([]);
    expect(m.lines).toEqual([2]);
  });
  it('says so when phone has no column', () => {
    expect(mapCsv(parseCsv('name,city\nA,B')).missing).toEqual(['phone']);
  });
});

describe('previewProblems', () => {
  it('flags the rows the API would refuse', () => {
    expect(previewProblems({ name: 'A', phone: '+91 98765 43210' })).toEqual([]);
    expect(previewProblems({ name: ' ', phone: '123' })).toHaveLength(2);
    expect(previewProblems({ name: 'A', phone: '9876543210', email: 'nope' })).toHaveLength(1);
  });
});
