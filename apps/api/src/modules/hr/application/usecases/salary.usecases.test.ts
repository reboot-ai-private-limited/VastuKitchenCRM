import { describe, expect, it } from 'vitest';
import { ID, world } from '../testing/fakes.js';

const MONTH = '2026-11'; // 30 days, 5 Sundays → 25 working days with "SUN"

/** Gives a person this many present days in November (on distinct working days). */
async function present(w: ReturnType<typeof world>, userId: string, days: number) {
  const dates = Array.from(
    { length: 10 },
    (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`,
  ).filter((d) => !['2026-11-01', '2026-11-08'].includes(d));
  const more = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 11).padStart(2, '0')}`);
  const pool = [...dates, ...more].filter(
    (d) => !['2026-11-15', '2026-11-22', '2026-11-29'].includes(d),
  );
  for (const d of pool.slice(0, days)) {
    if (d > '2026-11-11') continue;
    await w.attendance.checkIn({
      userId,
      date: d,
      inAt: new Date(`${d}T04:00:00Z`),
      outAt: null,
      method: 'GPS',
      inLocation: null,
      outLocation: null,
    });
  }
}

describe('the formula', () => {
  it('fixed salary × days present ÷ working days, to the rupee', async () => {
    const w = world();
    await present(w, ID.bio, 8); // 25,000 × 8 / 25 = 8,000
    await present(w, ID.bio2, 5); // 12,000 × 5 / 25 = 2,400
    const sheet = await w.generate.execute(MONTH);
    const row = (id: string) => sheet.rows.find((r) => r.userId === id)!;
    expect(row(ID.bio)).toMatchObject({
      presentDays: 8,
      workingDays: 25,
      computedPayable: 8000,
      payable: 8000,
      edited: false,
    });
    expect(row(ID.bio2)).toMatchObject({ presentDays: 5, computedPayable: 2400 });
    expect(row(ID.gps)).toMatchObject({ presentDays: 0, computedPayable: 0 });
    expect(sheet.totals).toEqual({
      fixedSalary: 30_000 + 20_000 + 25_000 + 12_000,
      payable: 10_400,
    });
    expect(sheet).toMatchObject({
      generated: true,
      weeklyOff: 'SUN',
      workingDays: 25,
      finalizedAt: null,
    });
  });

  it('rounds, and never pays more than the full salary for working extra days', async () => {
    const w = world('2026-11-30T10:00:00Z');
    w.directory.rows.find((s) => s.id === ID.bio)!.fixedSalary = 10_000;
    // 7 days of 25: 10,000 × 7 / 25 = 2,800 exactly; 3 days → 1,200; make an inexact one:
    w.directory.rows.find((s) => s.id === ID.bio2)!.fixedSalary = 10_001;
    for (let d = 2; d <= 10; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      await w.attendance.checkIn({
        userId: ID.bio2,
        date,
        inAt: new Date(`${date}T04:00:00Z`),
        outAt: null,
        method: 'GPS',
        inLocation: null,
        outLocation: null,
      });
    }
    // every calendar day of the month, Sundays included: 30 days present vs 25 working
    for (let d = 1; d <= 30; d++) {
      const date = `2026-11-${String(d).padStart(2, '0')}`;
      await w.attendance.checkIn({
        userId: ID.bio,
        date,
        inAt: new Date(`${date}T04:00:00Z`),
        outAt: null,
        method: 'GPS',
        inLocation: null,
        outLocation: null,
      });
    }
    const sheet = await w.generate.execute(MONTH);
    const row = (id: string) => sheet.rows.find((r) => r.userId === id)!;
    expect(row(ID.bio)).toMatchObject({ presentDays: 30, computedPayable: 10_000 }); // capped
    expect(row(ID.bio2).computedPayable).toBe(Math.round((10_001 * 9) / 25)); // 3,600.36 → 3,600
  });

  it('uses the weekly-off rule in force: fewer working days → a bigger share per day', async () => {
    const w = world();
    w.settings.weeklyOffText = 'SUN; SAT:1,3';
    await present(w, ID.bio, 8);
    const sheet = await w.generate.execute(MONTH);
    expect(sheet).toMatchObject({ workingDays: 23, weeklyOff: 'SUN; SAT:1,3' });
    expect(sheet.rows.find((r) => r.userId === ID.bio)?.computedPayable).toBe(
      Math.round((25_000 * 8) / 23),
    );
  });
});

describe('who is on the sheet', () => {
  it('active tracked staff, plus a deactivated person who still worked that month', async () => {
    const w = world();
    let sheet = await w.generate.execute(MONTH);
    expect(sheet.rows.map((r) => r.name).sort()).toEqual(['Anil', 'Bimal', 'Ravi', 'Rita']); // not Gita, not the Owner

    await present(w, ID.gone, 3);
    sheet = await w.generate.execute(MONTH);
    expect(sheet.rows.map((r) => r.name)).toContain('Gita');
    expect(sheet.rows.map((r) => r.name)).not.toContain('Owner');
  });

  it('refuses a month that has not started; an empty month says so', async () => {
    const w = world();
    await expect(w.generate.execute('2026-12')).rejects.toMatchObject({ statusCode: 400 });
    expect(await w.getSheet.execute('2026-10')).toMatchObject({
      generated: false,
      rows: [],
      workingDays: null,
    });
  });
});

describe('editing, regenerating and finalizing', () => {
  it('a hand-edited amount survives regenerating; untouched rows follow attendance', async () => {
    const w = world();
    await present(w, ID.bio, 4);
    await present(w, ID.bio2, 4);
    await w.generate.execute(MONTH);
    await w.editRow.execute(ID.hr, MONTH, ID.bio, { payable: 9_999, note: 'Advance adjusted' });

    await present(w, ID.bio, 8);
    await present(w, ID.bio2, 8);
    const sheet = await w.generate.execute(MONTH);
    const row = (id: string) => sheet.rows.find((r) => r.userId === id)!;
    expect(row(ID.bio)).toMatchObject({
      payable: 9_999,
      edited: true,
      note: 'Advance adjusted',
      presentDays: 8,
      computedPayable: 8_000,
    });
    expect(row(ID.bio2)).toMatchObject({ payable: 3_840, edited: false, presentDays: 8 }); // 12,000 × 8 / 25
  });

  it('editing needs a generated row', async () => {
    const w = world();
    await expect(w.editRow.execute(ID.hr, MONTH, ID.bio, { payable: 1 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('finalizing locks the month: no regenerate, no edits, no second finalize — and later changes do not leak in', async () => {
    const w = world();
    await present(w, ID.bio, 8);
    await w.generate.execute(MONTH);
    const done = await w.finalize.execute(ID.admin, MONTH);
    expect(done.finalizedAt).not.toBeNull();

    await expect(w.generate.execute(MONTH)).rejects.toMatchObject({ statusCode: 409 });
    await expect(w.editRow.execute(ID.hr, MONTH, ID.bio, { payable: 1 })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(w.finalize.execute(ID.admin, MONTH)).rejects.toMatchObject({ statusCode: 409 });

    // more attendance and a changed rule afterwards: the finalized sheet does not move
    await present(w, ID.bio, 12);
    w.settings.weeklyOffText = 'SUN; SAT:1,3';
    const sheet = await w.getSheet.execute(MONTH);
    expect(sheet.rows.find((r) => r.userId === ID.bio)).toMatchObject({
      presentDays: 8,
      workingDays: 25,
      payable: 8_000,
    });
    expect(sheet.weeklyOff).toBe('SUN');
  });

  it('cannot finalize what was never generated', async () => {
    const w = world();
    await expect(w.finalize.execute(ID.admin, MONTH)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('CSV export', () => {
  it('has a header, a row per person, and totals', async () => {
    const w = world();
    await present(w, ID.bio, 8);
    await w.generate.execute(MONTH);
    const lines = (await w.exportCsv.execute(MONTH)).trim().split('\n');
    expect(lines[0]).toBe(
      'Name,Designation,Fixed salary,Days present,Working days,Computed pay,Payable,Note',
    );
    expect(lines).toHaveLength(1 + 4 + 1);
    expect(lines.find((l) => l.startsWith('Rita,'))).toBe('Rita,Executive,25000,8,25,8000,8000,');
    expect(lines.at(-1)).toBe('Total,,87000,,,,8000,Not finalized');
  });

  it('quotes commas and quotes, and defuses spreadsheet formulas in names and notes', async () => {
    const w = world();
    w.directory.rows.find((s) => s.id === ID.bio)!.name = '=HYPERLINK("http://evil")';
    w.directory.rows.find((s) => s.id === ID.bio2)!.name = 'Das, Bimal "B"';
    await w.generate.execute(MONTH);
    await w.editRow.execute(ID.hr, MONTH, ID.gps, { payable: 5, note: '+cmd|calc' });
    const csv = await w.exportCsv.execute(MONTH);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain('"Das, Bimal ""B"""');
    expect(csv).toContain("'+cmd|calc");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('is not found before the month is generated', async () => {
    const w = world();
    await expect(w.exportCsv.execute(MONTH)).rejects.toMatchObject({ statusCode: 404 });
  });
});
