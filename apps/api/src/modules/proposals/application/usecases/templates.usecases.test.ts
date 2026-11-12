import {
  BUILTIN_PROPOSAL_TEMPLATES,
  DEFAULT_PROPOSAL_TEMPLATE_KEY,
  proposalTemplateSchema,
  type ProposalTemplate,
  type SaveProposalTemplateBodyDto,
} from '@vastu/contracts';
import { describe, expect, it } from 'vitest';
import { templateOrDefault } from '../../domain/proposal.entity.js';
import { admin, item, sales1, world } from '../testing/fakes.js';
import { CreateProposalUseCase } from './createProposal.usecase.js';
import { DuplicateProposalUseCase } from './duplicateProposal.usecase.js';
import { GetPublicProposalUseCase } from './publicProposal.usecase.js';
import { SendProposalUseCase } from './sendProposal.usecase.js';
import {
  CreateTemplateUseCase,
  DeleteTemplateUseCase,
  DuplicateTemplateUseCase,
  GetTemplateUseCase,
  ListTemplatesUseCase,
  UpdateTemplateUseCase,
} from './templates.usecase.js';
import { UpdateProposalUseCase } from './updateProposal.usecase.js';

const NOW = new Date('2026-11-10T10:00:00Z');
const BUILTIN = BUILTIN_PROPOSAL_TEMPLATES[1]!;

const mine = (name: string): SaveProposalTemplateBodyDto => {
  const copy: Partial<ProposalTemplate> = structuredClone(BUILTIN_PROPOSAL_TEMPLATES[2]!);
  delete copy.key;
  return { ...(copy as SaveProposalTemplateBodyDto), name };
};

function setup() {
  const w = world(() => NOW);
  return {
    w,
    list: new ListTemplatesUseCase(w.templateStore),
    get: new GetTemplateUseCase(w.templates),
    createTpl: new CreateTemplateUseCase(w.templateStore),
    updateTpl: new UpdateTemplateUseCase(w.templateStore, w.templates),
    removeTpl: new DeleteTemplateUseCase(w.templateStore, w.templates),
    dupTpl: new DuplicateTemplateUseCase(w.templateStore, w.templates),
    create: new CreateProposalUseCase(
      w.proposals,
      w.gateway,
      w.numbers,
      w.tokens,
      w.settings,
      w.templates,
      w.now,
    ),
    update: new UpdateProposalUseCase(w.access, w.proposals, w.templates, w.now),
    duplicate: new DuplicateProposalUseCase(
      w.access,
      w.proposals,
      w.gateway,
      w.numbers,
      w.tokens,
      w.now,
    ),
    send: new SendProposalUseCase(
      w.access,
      w.proposals,
      w.gateway,
      w.links,
      w.views,
      w.settings,
      w.now,
    ),
    getPublic: new GetPublicProposalUseCase(w.proposals, w.directory, w.settings, w.now),
  };
}
const body = (over = {}) => ({
  leadId: 'lead1',
  title: 'Kitchen',
  discount: 0,
  items: [item()],
  ...over,
});

describe('template gallery', () => {
  it('lists the built-ins first, then custom templates', async () => {
    const t = setup();
    await t.createTpl.execute(admin, mine('Mine'));
    const items = await t.list.execute();
    expect(items.slice(0, BUILTIN_PROPOSAL_TEMPLATES.length).every((i) => i.builtin)).toBe(true);
    expect(items.at(-1)).toMatchObject({ name: 'Mine', builtin: false });
    expect(items[0]).toMatchObject({ pageCount: BUILTIN_PROPOSAL_TEMPLATES[0]!.pages.length });
  });

  it('returns a full template by key, built-in or custom, and 404s otherwise', async () => {
    const t = setup();
    expect((await t.get.execute(BUILTIN.key)).key).toBe(BUILTIN.key);
    const mineT = await t.createTpl.execute(admin, mine('Mine'));
    expect(proposalTemplateSchema.safeParse(await t.get.execute(mineT.key)).success).toBe(true);
    await expect(t.get.execute('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('template writes', () => {
  it('are Admin only', async () => {
    const t = setup();
    const made = await t.createTpl.execute(admin, mine('Mine'));
    await expect(t.createTpl.execute(sales1, mine('x'))).rejects.toMatchObject({ statusCode: 403 });
    await expect(t.updateTpl.execute(sales1, made.key, mine('x'))).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(t.removeTpl.execute(sales1, made.key)).rejects.toMatchObject({ statusCode: 403 });
    await expect(t.dupTpl.execute(sales1, made.key)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuse to change or delete a built-in', async () => {
    const t = setup();
    await expect(t.updateTpl.execute(admin, BUILTIN.key, mine('x'))).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(t.removeTpl.execute(admin, BUILTIN.key)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('replace and delete a custom template; unknown keys are 404', async () => {
    const t = setup();
    const made = await t.createTpl.execute(admin, mine('Mine'));
    expect((await t.updateTpl.execute(admin, made.key, mine('Renamed'))).name).toBe('Renamed');
    await t.removeTpl.execute(admin, made.key);
    await expect(t.updateTpl.execute(admin, made.key, mine('x'))).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(t.removeTpl.execute(admin, made.key)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('duplicate any template into a new editable one, named "<name> copy" by default', async () => {
    const t = setup();
    const copy = await t.dupTpl.execute(admin, BUILTIN.key);
    expect(copy.key).not.toBe(BUILTIN.key);
    expect(copy.name).toBe(`${BUILTIN.name} copy`);
    expect(copy.pages).toEqual(BUILTIN.pages);
    expect((await t.dupTpl.execute(admin, BUILTIN.key, 'Festive')).name).toBe('Festive');
    // The copy is editable.
    await expect(t.updateTpl.execute(admin, copy.key, mine('ok'))).resolves.toBeTruthy();
  });
});

describe('templates on proposals', () => {
  it('uses the default template when none is chosen, and snapshots it', async () => {
    const t = setup();
    const p = await t.create.execute(sales1, body());
    expect(p.templateKey).toBe(DEFAULT_PROPOSAL_TEMPLATE_KEY);
    expect(p.template.key).toBe(DEFAULT_PROPOSAL_TEMPLATE_KEY);
  });

  it('snapshots the chosen custom template and is unaffected by later edits or deletion', async () => {
    const t = setup();
    const tpl = await t.createTpl.execute(admin, mine('Mine'));
    const p = await t.create.execute(sales1, body({ templateKey: tpl.key }));
    expect(p.template.name).toBe('Mine');
    await t.updateTpl.execute(admin, tpl.key, mine('Changed'));
    expect((await t.w.proposals.findById(p.id))!.template.name).toBe('Mine');
    await t.removeTpl.execute(admin, tpl.key);
    expect((await t.w.proposals.findById(p.id))!.template.name).toBe('Mine');
  });

  it('rejects an unknown template key', async () => {
    const t = setup();
    await expect(t.create.execute(sales1, body({ templateKey: 'tpl_nope' }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('re-snapshots when a draft changes template, and refuses once sent', async () => {
    const t = setup();
    const p = await t.create.execute(sales1, body());
    const changed = await t.update.execute(sales1, p.id, { templateKey: BUILTIN.key });
    expect(changed.templateKey).toBe(BUILTIN.key);
    expect(changed.template.name).toBe(BUILTIN.name);
    await t.send.execute(sales1, p.id);
    await expect(
      t.update.execute(sales1, p.id, { templateKey: DEFAULT_PROPOSAL_TEMPLATE_KEY }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('keeps the snapshot a deep copy, not the built-in object itself', async () => {
    const t = setup();
    const p = await t.create.execute(sales1, body());
    expect(p.template).not.toBe(BUILTIN_PROPOSAL_TEMPLATES[0]);
    expect(p.template).toEqual(BUILTIN_PROPOSAL_TEMPLATES[0]);
  });

  it('carries the snapshot to a duplicate and serves it on the public page', async () => {
    const t = setup();
    const p = await t.create.execute(sales1, body({ templateKey: BUILTIN.key }));
    const sent = await t.send.execute(sales1, p.id);
    const copy = await t.duplicate.execute(sales1, p.id);
    expect(copy.templateKey).toBe(BUILTIN.key);
    expect(copy.template).toEqual(p.template);
    const view = await t.getPublic.execute(sent.view.proposal.token);
    expect(view.proposal.template.key).toBe(BUILTIN.key);
  });
});

describe('legacy proposals', () => {
  it('read as the default built-in template when none was stored', () => {
    const legacy = templateOrDefault(undefined, undefined);
    expect(legacy.templateKey).toBe(DEFAULT_PROPOSAL_TEMPLATE_KEY);
    expect(legacy.template.key).toBe(DEFAULT_PROPOSAL_TEMPLATE_KEY);
    expect(templateOrDefault(null, null).templateKey).toBe(DEFAULT_PROPOSAL_TEMPLATE_KEY);
  });
  it('keep a stored template untouched', () => {
    const got = templateOrDefault(BUILTIN.key, BUILTIN);
    expect(got).toEqual({ templateKey: BUILTIN.key, template: BUILTIN });
  });
});
