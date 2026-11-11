import { describe, expect, it } from 'vitest';
import { hash } from './attendance.usecases.js';
import { ID, as, world } from '../testing/fakes.js';

const ADMIN = as(ID.admin, 'ADMIN');
const HR = as(ID.hr, 'HR');

describe('GPS check-in and check-out', () => {
  it('records the time from the server clock, on the business day', async () => {
    const w = world('2026-11-10T19:00:00Z'); // 00:30 on the 11th in Siliguri, still the 10th in UTC
    const out = await w.checkIn.execute(as(ID.gps), {
      location: { lat: 26.7, lng: 88.4, accuracy: 12 },
    });
    expect(out).toMatchObject({
      date: '2026-11-11',
      status: 'PRESENT',
      method: 'GPS',
      outAt: null,
    });
    expect(out.inAt).toBe('2026-11-10T19:00:00.000Z');
    expect(out.inLocation).toEqual({ lat: 26.7, lng: 88.4, accuracy: 12 });
  });

  it('a second tap keeps the first check-in', async () => {
    const w = world();
    const first = await w.checkIn.execute(as(ID.gps), {});
    w.set('2026-11-11T09:00:00Z');
    const second = await w.checkIn.execute(as(ID.gps), { location: { lat: 1, lng: 1 } });
    expect(second.inAt).toBe(first.inAt);
    expect(second.inLocation).toBeNull();
    expect(w.attendance.rows).toHaveLength(1);
  });

  it('many simultaneous check-ins make one record', async () => {
    const w = world();
    await Promise.all(Array.from({ length: 5 }, () => w.checkIn.execute(as(ID.gps), {})));
    expect(w.attendance.rows).toHaveLength(1);
  });

  it('check-out needs a check-in first, then the last check-out wins', async () => {
    const w = world();
    await expect(w.checkOut.execute(as(ID.gps), {})).rejects.toMatchObject({ statusCode: 409 });
    await w.checkIn.execute(as(ID.gps), {});
    w.set('2026-11-11T12:00:00Z');
    await w.checkOut.execute(as(ID.gps), {});
    w.set('2026-11-11T13:00:00Z');
    const out = await w.checkOut.execute(as(ID.gps), {});
    expect(out.outAt).toBe('2026-11-11T13:00:00.000Z');
  });

  it('is only for GPS-tracked, active staff', async () => {
    const w = world();
    for (const id of [ID.bio, ID.gone, ID.none, 'someone-unknown'])
      await expect(w.checkIn.execute(as(id), {})).rejects.toMatchObject({ statusCode: 403 });
    const gone = w.directory.rows.find((s) => s.id === ID.gone)!;
    gone.attendanceType = 'GPS';
    await expect(w.checkIn.execute(as(ID.gone), {})).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('a month, day by day', () => {
  it('marks present, absent, weekly off and future days; counts working days', async () => {
    const w = world(); // Wed 11 Nov 2026
    await w.setDay.execute(ADMIN, ID.bio, '2026-11-02', {
      inAt: '2026-11-02T03:30:00Z',
      outAt: '2026-11-02T12:30:00Z',
    });
    await w.setDay.execute(ADMIN, ID.bio, '2026-11-03', { inAt: '2026-11-03T03:30:00Z' }); // no out
    const m = await w.userMonth.execute(HR, ID.bio, '2026-11');
    const by = (d: string) => m.days.find((x) => x.date === d)!;
    expect(by('2026-11-02')).toMatchObject({
      status: 'PRESENT',
      missingOut: false,
      method: 'BIOMETRIC_SIM',
    });
    expect(by('2026-11-03')).toMatchObject({ status: 'PRESENT', missingOut: true });
    expect(by('2026-11-04').status).toBe('ABSENT');
    expect(by('2026-11-08')).toMatchObject({ status: 'OFF', offDay: true }); // a Sunday
    expect(by('2026-11-12').status).toBe('FUTURE');
    expect(m).toMatchObject({ workingDays: 25, presentDays: 2, missingOutDays: 1 });
    expect(m.days).toHaveLength(30);
  });

  it("today's missing out-time is not a problem yet", async () => {
    const w = world();
    await w.checkIn.execute(as(ID.gps), {});
    const m = await w.myMonth.execute(as(ID.gps));
    expect(m.days.find((d) => d.date === '2026-11-11')).toMatchObject({
      status: 'PRESENT',
      missingOut: false,
    });
  });

  it('follows the weekly-off rule: 1st and 3rd Saturdays off as well', async () => {
    const w = world();
    w.settings.weeklyOffText = 'SUN; SAT:1,3';
    const m = await w.myMonth.execute(as(ID.gps), '2026-11');
    expect(m.workingDays).toBe(23);
    const off = m.days.filter((d) => d.offDay).map((d) => d.date);
    expect(off).toContain('2026-11-07'); // 1st Saturday
    expect(off).not.toContain('2026-11-14'); // 2nd
    expect(off).toContain('2026-11-21'); // 3rd
  });

  it('working on a day off still counts as present', async () => {
    const w = world();
    await w.setDay.execute(ADMIN, ID.bio, '2026-11-08', { inAt: '2026-11-08T03:30:00Z' });
    const m = await w.userMonth.execute(ADMIN, ID.bio, '2026-11');
    expect(m.days.find((d) => d.date === '2026-11-08')?.status).toBe('PRESENT');
    expect(m.presentDays).toBe(1);
  });

  it('who may look: Admin/HR anyone tracked, others only themselves', async () => {
    const w = world();
    await expect(w.userMonth.execute(as(ID.gps), ID.gps)).resolves.toBeTruthy();
    await expect(w.userMonth.execute(as(ID.gps), ID.bio)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(w.userMonth.execute(HR, ID.bio)).resolves.toBeTruthy();
    await expect(w.userMonth.execute(HR, ID.none)).rejects.toMatchObject({ statusCode: 404 }); // not tracked
    await expect(w.userMonth.execute(HR, 'nobody')).rejects.toMatchObject({ statusCode: 404 });
    await expect(w.myMonth.execute(as(ID.none, 'ADMIN'))).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("everyone's day (the board)", () => {
  it('lists only active, tracked staff with present / absent / missing-out counts', async () => {
    const w = world();
    await w.checkIn.execute(as(ID.gps), {});
    await w.setDay.execute(ADMIN, ID.bio, '2026-11-10', { inAt: '2026-11-10T03:30:00Z' }); // yesterday, no out

    const today = await w.board.execute();
    expect(today.date).toBe('2026-11-11');
    expect(today.items.map((i) => i.name).sort()).toEqual(['Anil', 'Bimal', 'Ravi', 'Rita']);
    expect(today.counts).toEqual({ present: 1, absent: 3, missingOut: 0 });

    const yesterday = await w.board.execute('2026-11-10');
    expect(yesterday.counts).toEqual({ present: 1, absent: 3, missingOut: 1 });
  });

  it('shows a weekly off as OFF, not absent', async () => {
    const w = world();
    const sunday = await w.board.execute('2026-11-08');
    expect(sunday.offDay).toBe(true);
    expect(sunday.counts.absent).toBe(0);
    expect(sunday.items.every((i) => i.day.status === 'OFF')).toBe(true);
  });
});

describe('Admin/HR recording and correcting a day', () => {
  it('creates a day (biometric → simulated punch, GPS person → manual) and marks later changes corrected', async () => {
    const w = world();
    const created = await w.setDay.execute(HR, ID.bio, '2026-11-09', {
      inAt: '2026-11-09T03:40:00Z',
      outAt: '2026-11-09T12:40:00Z',
    });
    expect(created).toMatchObject({ method: 'BIOMETRIC_SIM', corrected: false });
    const manual = await w.setDay.execute(HR, ID.gps, '2026-11-09', {
      inAt: '2026-11-09T03:40:00Z',
    });
    expect(manual.method).toBe('MANUAL');

    const fixed = await w.setDay.execute(HR, ID.bio, '2026-11-09', {
      inAt: '2026-11-09T03:30:00Z',
      outAt: null,
      note: 'Forgot to punch out',
    });
    expect(fixed).toMatchObject({ corrected: true, outAt: null, note: 'Forgot to punch out' });
    expect(w.attendance.rows.find((r) => r.userId === ID.bio)?.correctedById).toBe(ID.hr);
  });

  it('refuses a future day, times on another day, and an out before the in', async () => {
    const w = world();
    const bad = (date: string, inAt: string, outAt?: string) =>
      w.setDay.execute(ADMIN, ID.bio, date, { inAt, ...(outAt ? { outAt } : {}) });
    await expect(bad('2026-11-12', '2026-11-12T03:30:00Z')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(bad('2026-11-09', '2026-11-08T03:30:00Z')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      bad('2026-11-09', '2026-11-09T09:00:00Z', '2026-11-09T04:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 400 });
    // 11:00 pm IST on the 9th is still the 9th, though it is the 9th 17:30 UTC
    await expect(
      bad('2026-11-09', '2026-11-09T03:30:00Z', '2026-11-09T17:30:00Z'),
    ).resolves.toBeTruthy();
    await expect(
      bad('2026-11-09', '2026-11-09T03:30:00Z', '2026-11-09T19:00:00Z'),
    ).rejects.toMatchObject({ statusCode: 400 }); // 00:30 on the 10th
  });

  it('only for tracked staff; a day can be removed', async () => {
    const w = world();
    await expect(
      w.setDay.execute(ADMIN, ID.none, '2026-11-09', { inAt: '2026-11-09T03:30:00Z' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await w.setDay.execute(ADMIN, ID.bio, '2026-11-09', { inAt: '2026-11-09T03:30:00Z' });
    await w.deleteDay.execute(ID.bio, '2026-11-09');
    await expect(w.deleteDay.execute(ID.bio, '2026-11-09')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('demo attendance', () => {
  it('fills past working days only — not today, not days off — and every method matches the person', async () => {
    const w = world();
    const result = await w.simulate.execute(14);
    expect(result.created).toBeGreaterThan(30);
    expect(result.skipped).toBe(0);
    const dates = new Set(w.attendance.rows.map((r) => r.date));
    expect(dates.has('2026-11-11')).toBe(false); // today
    expect(dates.has('2026-11-08')).toBe(false); // a Sunday
    expect(dates.has('2026-11-10')).toBe(true);
    for (const r of w.attendance.rows) {
      expect(r.method).toBe(r.userId === ID.gps || r.userId === ID.gps2 ? 'GPS' : 'BIOMETRIC_SIM');
      if (r.method === 'GPS') expect(r.inLocation).not.toBeNull();
      else expect(r.inLocation).toBeNull();
    }
    expect(w.attendance.rows.some((r) => r.userId === ID.gone || r.userId === ID.none)).toBe(false);
  });

  it('is safe to run twice and never overwrites a real day', async () => {
    const w = world();
    await w.setDay.execute(ADMIN, ID.bio, '2026-11-10', {
      inAt: '2026-11-10T03:00:00Z',
      note: 'real',
    });
    await w.simulate.execute(5);
    expect(
      w.attendance.rows.find((r) => r.userId === ID.bio && r.date === '2026-11-10')?.note,
    ).toBe('real');
    const count = w.attendance.rows.length;
    const again = await w.simulate.execute(5);
    expect(again.created).toBe(0);
    expect(w.attendance.rows).toHaveLength(count);
  });

  it('gives the same numbers for the same person and day', () => {
    expect(hash('u1:2026-11-03')).toBe(hash('u1:2026-11-03'));
    expect(hash('u1:2026-11-03')).not.toBe(hash('u2:2026-11-03'));
  });
});
