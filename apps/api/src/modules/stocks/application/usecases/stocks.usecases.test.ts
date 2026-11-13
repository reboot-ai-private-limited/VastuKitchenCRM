import { describe, expect, it } from 'vitest';
import { ID, world } from '../testing/fakes.js';

const admin = { id: ID.admin };
const newItem = (w: ReturnType<typeof world>, over: Record<string, unknown> = {}) =>
  w.create.execute(admin, {
    name: 'Plywood 18mm',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 5,
    openingQuantity: 0,
    ...over,
  });

describe('adding an item', () => {
  it('starts at zero when there is no opening balance', async () => {
    const w = world();
    const i = await newItem(w);
    expect(i.quantity).toBe(0);
    expect(w.repo.movements).toHaveLength(0);
  });

  it('records the opening balance as the first IN line', async () => {
    const w = world();
    const i = await newItem(w, { openingQuantity: 20 });
    expect(i.quantity).toBe(20);
    expect(w.repo.movements).toMatchObject([{ type: 'IN', quantity: 20, note: 'Opening balance' }]);
  });
});

describe('recording stock', () => {
  it('IN adds, OUT removes, and each line keeps the balance after it', async () => {
    const w = world();
    const i = await newItem(w);
    await w.record.execute(admin, i.id, { type: 'IN', quantity: 10, note: null });
    const out = await w.record.execute(admin, i.id, {
      type: 'OUT',
      quantity: 4,
      note: 'Rao kitchen',
    });
    expect(out.item.quantity).toBe(6);
    expect(out.view.movement).toMatchObject({
      type: 'OUT',
      quantity: 4,
      balanceAfter: 6,
      note: 'Rao kitchen',
    });
    expect(out.view.by).toEqual({ id: ID.admin, name: 'Admin' });
  });

  it('refuses to take out more than is in stock, and changes nothing', async () => {
    const w = world();
    const i = await newItem(w, { openingQuantity: 3 });
    await expect(
      w.record.execute(admin, i.id, { type: 'OUT', quantity: 4, note: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await w.repo.findItem(i.id))?.quantity).toBe(3);
    expect(w.repo.movements).toHaveLength(1);
  });

  it('ADJUST sets the counted total and stores the signed difference', async () => {
    const w = world();
    const i = await newItem(w, { openingQuantity: 10 });
    const r = await w.record.execute(admin, i.id, { type: 'ADJUST', quantity: 7, note: 'Recount' });
    expect(r.item.quantity).toBe(7);
    expect(r.view.movement).toMatchObject({ type: 'ADJUST', quantity: -3, balanceAfter: 7 });
  });

  it('refuses a zero IN or OUT, but allows counting zero', async () => {
    const w = world();
    const i = await newItem(w, { openingQuantity: 2 });
    await expect(
      w.record.execute(admin, i.id, { type: 'IN', quantity: 0, note: null }),
    ).rejects.toMatchObject({ statusCode: 400 });
    const r = await w.record.execute(admin, i.id, { type: 'ADJUST', quantity: 0, note: null });
    expect(r.item.quantity).toBe(0);
  });

  it('is a 404 for an unknown item and a 409 for an archived one', async () => {
    const w = world();
    await expect(
      w.record.execute(admin, '0'.repeat(24), { type: 'IN', quantity: 1, note: null }),
    ).rejects.toMatchObject({ statusCode: 404 });
    const i = await newItem(w);
    await w.update.execute(i.id, { archived: true });
    await expect(
      w.record.execute(admin, i.id, { type: 'IN', quantity: 1, note: null }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('listing', () => {
  it('hides archived items and finds low ones', async () => {
    const w = world();
    const low = await newItem(w, { name: 'Hinges', minLevel: 10, openingQuantity: 4 });
    await newItem(w, { name: 'Channels', minLevel: 2, openingQuantity: 50 });
    const gone = await newItem(w, { name: 'Old glue' });
    await w.update.execute(gone.id, { archived: true });
    const base = {
      lowOnly: false,
      includeArchived: false,
      page: 1,
      pageSize: 20,
      sortOrder: 'desc' as const,
    };
    expect((await w.list.execute(base)).items.map((x) => x.name)).toEqual(['Channels', 'Hinges']);
    expect((await w.list.execute({ ...base, lowOnly: true })).items.map((x) => x.id)).toEqual([
      low.id,
    ]);
  });

  it('shows history newest first', async () => {
    const w = world();
    const i = await newItem(w, { openingQuantity: 5 });
    await w.record.execute(admin, i.id, { type: 'OUT', quantity: 1, note: null });
    const h = await w.movements.execute(i.id, { page: 1, pageSize: 20 });
    expect(h.items.map((v) => v.movement.type)).toEqual(['OUT', 'IN']);
  });
});
