import { describe, expect, it } from 'vitest';
import { buildItems, computeTotals, isExpired } from '../../domain/proposal.entity.js';
import { CreateProposalUseCase } from './createProposal.usecase.js';
import { DuplicateProposalUseCase } from './duplicateProposal.usecase.js';
import { GetPublicProposalUseCase, RecordProposalSeenUseCase } from './publicProposal.usecase.js';
import { GetProposalUseCase, ListProposalsUseCase } from './queries.usecase.js';
import { SendProposalUseCase } from './sendProposal.usecase.js';
import { DeleteProposalUseCase, UpdateProposalUseCase } from './updateProposal.usecase.js';
import { admin, item, sales1, sales2, world } from '../testing/fakes.js';

const NOW = new Date('2026-11-10T10:00:00Z');

function setup() {
  const w = world(() => NOW);
  return {
    w,
    create: new CreateProposalUseCase(
      w.proposals,
      w.gateway,
      w.numbers,
      w.tokens,
      w.settings,
      w.now,
    ),
    update: new UpdateProposalUseCase(w.access, w.proposals, w.now),
    remove: new DeleteProposalUseCase(w.access, w.proposals),
    send: new SendProposalUseCase(
      w.access,
      w.proposals,
      w.gateway,
      w.links,
      w.views,
      w.settings,
      w.now,
    ),
    duplicate: new DuplicateProposalUseCase(
      w.access,
      w.proposals,
      w.gateway,
      w.numbers,
      w.tokens,
      w.now,
    ),
    getPublic: new GetPublicProposalUseCase(w.proposals, w.directory, w.settings, w.now),
    seen: new RecordProposalSeenUseCase(w.proposals, w.gateway, w.events, w.now),
    get: new GetProposalUseCase(w.access, w.views),
    list: new ListProposalsUseCase(w.proposals, w.gateway, w.views),
  };
}
const body = (over = {}) => ({
  leadId: 'lead1',
  title: 'Kitchen',
  discount: 0,
  items: [item()],
  ...over,
});

describe('totals', () => {
  it('uses whole rupees and rounds a fractional quantity line', () => {
    const items = buildItems([
      { title: 'Granite counter', quantity: 12.5, unitPrice: 1_201 },
      { title: 'Chimney', quantity: 1, unitPrice: 20_000 },
    ]);
    expect(items[0]?.lineTotal).toBe(15_013); // 12.5 × 1201 = 15012.5 → 15013
    expect(computeTotals(items, 5_000)).toEqual({ subtotal: 35_013, total: 30_013 });
  });

  it('refuses a discount larger than the subtotal', () => {
    expect(() => computeTotals(buildItems([item({ unitPrice: 100 })]), 101)).toThrowError(
      /discount/i,
    );
  });

  it('treats validUntil as valid through the end of that day', () => {
    const day = new Date('2026-11-10T00:00:00Z');
    expect(isExpired(day, new Date('2026-11-10T23:00:00Z'))).toBe(false);
    expect(isExpired(day, new Date('2026-11-11T00:00:00Z'))).toBe(true);
    expect(isExpired(null, NOW)).toBe(false);
  });
});

describe('CreateProposalUseCase', () => {
  it('snapshots the customer, numbers sequentially, and starts as a draft with default terms', async () => {
    const { w, create } = setup();
    const a = await create.execute(sales1, body());
    const b = await create.execute(sales1, body());
    expect([a.number, b.number]).toEqual(['VK-2026-0001', 'VK-2026-0002']);
    expect(a.status).toBe('DRAFT');
    expect(a.customer).toEqual({
      name: 'Mrs Rao Devi',
      phone: '9876500001',
      city: 'Siliguri',
      siteAddress: null,
    });
    expect(a.terms).toBe('DEFAULT TERMS');
    expect(a.total).toBe(450_000);
    expect(a.token).not.toBe(b.token);
    expect(w.proposals.rows).toHaveLength(2);
  });

  it('refuses a lead the user cannot access, and a past valid-until date', async () => {
    const { create } = setup();
    await expect(create.execute(sales2, body())).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      create.execute(sales1, body({ validUntil: new Date('2026-11-01T00:00:00Z') })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('editing', () => {
  it('recomputes totals when items or the discount change', async () => {
    const { create, update } = setup();
    const p = await create.execute(sales1, body({ discount: 10_000 }));
    const changed = await update.execute(sales1, p.id, { items: [item({ unitPrice: 500_000 })] });
    expect([changed.subtotal, changed.discount, changed.total]).toEqual([500_000, 10_000, 490_000]);
    const onlyDiscount = await update.execute(sales1, p.id, { discount: 0 });
    expect(onlyDiscount.total).toBe(500_000);
  });

  it('clears an optional field with null and refuses a discount above the new subtotal', async () => {
    const { create, update } = setup();
    const p = await create.execute(sales1, body({ notes: 'hello' }));
    expect((await update.execute(sales1, p.id, { notes: null })).notes).toBeNull();
    await expect(update.execute(sales1, p.id, { discount: 999_999_999 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('freezes a sent proposal: no edit, no delete', async () => {
    const { create, update, remove, send } = setup();
    const p = await create.execute(sales1, body());
    await send.execute(sales1, p.id);
    await expect(update.execute(sales1, p.id, { title: 'Changed' })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(remove.execute(sales1, p.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('lets a draft be deleted', async () => {
    const { w, create, remove } = setup();
    const p = await create.execute(sales1, body());
    await remove.execute(sales1, p.id);
    expect(w.proposals.rows).toHaveLength(0);
  });

  it("hides another person's proposals as not found", async () => {
    const { create, update, get } = setup();
    const p = await create.execute(sales1, body());
    await expect(update.execute(sales2, p.id, { title: 'x' })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(get.execute(sales2, p.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(get.execute(admin, p.id)).resolves.toBeDefined();
  });
});

describe('SendProposalUseCase', () => {
  it('marks it sent, tells the lead once, and returns the public and WhatsApp links', async () => {
    const { w, create, send } = setup();
    const p = await create.execute(sales1, body());
    const r = await send.execute(sales1, p.id);

    expect(r.view.proposal.status).toBe('SENT');
    expect(r.publicUrl).toBe(`https://admin.example.com/p/${p.token}`);
    expect(r.whatsappUrl.startsWith('https://wa.me/919876500001?text=')).toBe(true);
    const text = decodeURIComponent(r.whatsappUrl.split('?text=')[1]!);
    expect(text).toBe(
      `Namaste Mrs, here is your proposal VK-2026-0001 from Vaastu Kitchen: ${r.publicUrl}`,
    );
    expect(w.gateway.sent).toEqual([{ leadId: 'lead1', number: 'VK-2026-0001', by: 'sales1' }]);
  });

  it('sending again returns the SAME links and does not touch the lead again', async () => {
    const { w, create, send } = setup();
    const p = await create.execute(sales1, body());
    const first = await send.execute(sales1, p.id);
    const again = await send.execute(sales1, p.id);
    expect(again.publicUrl).toBe(first.publicUrl);
    expect(again.whatsappUrl).toBe(first.whatsappUrl);
    expect(w.gateway.sent).toHaveLength(1);
  });

  it('only exposes the public link once sent', async () => {
    const { create, get, send } = setup();
    const p = await create.execute(sales1, body());
    expect((await get.execute(sales1, p.id)).publicUrl).toBeNull();
    await send.execute(sales1, p.id);
    expect((await get.execute(sales1, p.id)).publicUrl).not.toBeNull();
  });
});

describe('duplicate', () => {
  it('copies a sent proposal into a fresh draft with a new number and link', async () => {
    const { w, create, send, duplicate } = setup();
    const p = await create.execute(sales1, body({ discount: 5_000, notes: 'keep' }));
    await send.execute(sales1, p.id);
    const copy = await duplicate.execute(sales1, p.id);
    expect(copy.status).toBe('DRAFT');
    expect(copy.number).toBe('VK-2026-0002');
    expect(copy.token).not.toBe(p.token);
    expect([copy.total, copy.discount, copy.notes]).toEqual([445_000, 5_000, 'keep']);
    expect([copy.sentAt, copy.firstSeenAt, copy.seenCount]).toEqual([null, null, 0]);
    expect(w.proposals.rows).toHaveLength(2);
  });
});

describe('who counts as a viewer', () => {
  it('does not count signed-in staff, but counts anonymous visitors and customers', async () => {
    const { w, create, send, seen } = setup();
    const p = await create.execute(sales1, body());
    await send.execute(sales1, p.id);
    const browser = 'Mozilla/5.0 (Linux; Android 14) Chrome/120';

    await seen.execute(p.token, browser, { id: 'admin1', role: 'ADMIN' });
    await seen.execute(p.token, browser, { id: 'sales1', role: 'SALES' });
    expect(w.proposals.rows[0]?.seenCount).toBe(0);
    expect(w.events.seen).toHaveLength(0);

    await seen.execute(p.token, browser, { id: 'cust1', role: 'CUSTOMER' });
    await seen.execute(p.token, browser);
    expect(w.proposals.rows[0]?.seenCount).toBe(2);
    expect(w.events.seen).toHaveLength(1);
  });
});

describe('public page and seen tracking', () => {
  it('never shows a draft, and loading the page records nothing', async () => {
    const { w, create, send, getPublic } = setup();
    const p = await create.execute(sales1, body());
    await expect(getPublic.execute(p.token)).rejects.toMatchObject({ statusCode: 404 });
    await send.execute(sales1, p.id);
    const view = await getPublic.execute(p.token);
    expect(view.sentByName).toBe('Ravi');
    expect(w.proposals.rows[0]?.seenCount).toBe(0);
    expect(w.events.seen).toHaveLength(0);
  });

  it('the first view writes the timeline and fires proposal.seen once; later views only count', async () => {
    const { w, create, send, seen } = setup();
    const p = await create.execute(sales1, body());
    await send.execute(sales1, p.id);

    await seen.execute(p.token, 'Mozilla/5.0 (Linux; Android 14) Chrome/120');
    await seen.execute(p.token, 'Mozilla/5.0 (iPhone) Safari');
    await seen.execute(p.token, 'Mozilla/5.0 (Windows) Edge');

    expect(w.proposals.rows[0]?.seenCount).toBe(3);
    expect(w.gateway.seen).toEqual([{ leadId: 'lead1', number: 'VK-2026-0001' }]);
    expect(w.events.seen).toEqual([
      {
        proposalId: p.id,
        leadId: 'lead1',
        number: 'VK-2026-0001',
        sentById: 'sales1',
        customerName: 'Mrs Rao Devi',
      },
    ]);
  });

  it.each([
    'WhatsApp link preview facebookexternalhit/1.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'curl/8.0.1',
    'Slackbot-LinkExpanding 1.0',
  ])('ignores link-preview and bot traffic: %s', async (agent) => {
    const { w, create, send, seen } = setup();
    const p = await create.execute(sales1, body());
    await send.execute(sales1, p.id);
    await seen.execute(p.token, agent);
    expect(w.proposals.rows[0]?.seenCount).toBe(0);
    expect(w.events.seen).toHaveLength(0);
  });

  it('is silent for an unknown token or a draft', async () => {
    const { w, create, seen } = setup();
    const p = await create.execute(sales1, body());
    await expect(seen.execute('no-such-token-xxxxxxxxxxxx', 'Chrome')).resolves.toBeUndefined();
    await expect(seen.execute(p.token, 'Chrome')).resolves.toBeUndefined();
    expect(w.events.seen).toHaveLength(0);
  });

  it('flags an expired proposal but still serves it', async () => {
    let t = NOW;
    const w = world(() => t);
    const create = new CreateProposalUseCase(
      w.proposals,
      w.gateway,
      w.numbers,
      w.tokens,
      w.settings,
      () => t,
    );
    const send = new SendProposalUseCase(
      w.access,
      w.proposals,
      w.gateway,
      w.links,
      w.views,
      w.settings,
      () => t,
    );
    const getPublic = new GetPublicProposalUseCase(w.proposals, w.directory, w.settings, () => t);
    const p = await create.execute(sales1, body({ validUntil: new Date('2026-11-12T00:00:00Z') }));
    await send.execute(sales1, p.id);
    expect((await getPublic.execute(p.token)).isExpired).toBe(false);
    t = new Date('2026-11-13T00:00:00Z');
    expect((await getPublic.execute(p.token)).isExpired).toBe(true);
  });
});

describe('ListProposalsUseCase', () => {
  it('limits Sales to what they made, unless filtering by a lead they can access', async () => {
    const { w, create, list } = setup();
    await create.execute(sales1, body());
    await create.execute(admin, body());
    const own = await list.execute(sales1, { page: 1, pageSize: 20 });
    expect(own.items.every((v) => v.proposal.createdById === 'sales1')).toBe(true);
    expect(own.total).toBe(1);

    const forLead = await list.execute(sales1, { page: 1, pageSize: 20, leadId: 'lead1' });
    expect(forLead.total).toBe(2);
    expect(w.proposals.lastFilter?.createdById).toBeUndefined();

    await expect(
      list.execute(sales2, { page: 1, pageSize: 20, leadId: 'lead1' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await list.execute(admin, { page: 1, pageSize: 20 })).total).toBe(2);
  });
});
