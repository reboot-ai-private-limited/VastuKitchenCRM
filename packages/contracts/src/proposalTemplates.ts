import { z } from 'zod';

/**
 * A proposal template is DATA: a theme plus an ordered list of A4 pages, each page a list of
 * blocks. The web app renders it (`components/proposals/render`); nothing here is executable.
 * Text may carry tokens such as `{{client.name}}`, filled in when the proposal is rendered.
 */

export const PROPOSAL_PAGE_KINDS = ['cover', 'content', 'pricing', 'terms', 'thankyou'] as const;
export const proposalPageKindSchema = z.enum(PROPOSAL_PAGE_KINDS);
export type ProposalPageKind = z.infer<typeof proposalPageKindSchema>;

export const COVER_LAYOUTS = ['hero', 'split', 'minimal'] as const;
export const THANKYOU_LAYOUTS = ['hero', 'split', 'minimal'] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const text = z.string().max(2000);
const short = z.string().max(200);
const url = z.string().max(500);

export const proposalThemeSchema = z.object({
  /** Brand colour: headings accents, table header, rules. */
  primary: hex,
  /** Body text and dark surfaces. */
  ink: hex,
  /** Page background. */
  paper: hex,
  /** Soft panels and zebra rows. */
  tint: hex,
  /** A secondary accent (gold on the classic theme). */
  accent: hex,
  /** `serif` uses the display font for headings, `sans` keeps one family. */
  headingFont: z.enum(['serif', 'sans']),
});
export type ProposalTheme = z.infer<typeof proposalThemeSchema>;

export const proposalBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), eyebrow: short.optional(), text: short }),
  z.object({ type: z.literal('richText'), text }),
  z.object({
    type: z.literal('stats'),
    items: z.array(z.object({ value: short, label: short })).min(1).max(6),
  }),
  z.object({
    type: z.literal('bullets'),
    title: short.optional(),
    items: z.array(short).min(1).max(20),
    columns: z.union([z.literal(1), z.literal(2)]).default(1),
  }),
  z.object({
    type: z.literal('steps'),
    title: short.optional(),
    items: z.array(z.object({ title: short, text: short.optional() })).min(1).max(12),
  }),
  z.object({
    type: z.literal('image'),
    src: url,
    alt: short,
    caption: short.optional(),
    /** Height in px on the A4 sheet (794 × 1123). */
    height: z.number().int().min(80).max(700).default(300),
  }),
  z.object({
    type: z.literal('gallery'),
    images: z.array(z.object({ src: url, alt: short })).min(1).max(9),
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
  }),
  z.object({
    type: z.literal('team'),
    title: short.optional(),
    members: z.array(z.object({ name: short, role: short })).min(1).max(8),
  }),
  z.object({ type: z.literal('logos'), title: short.optional(), names: z.array(short).min(1).max(16) }),
  z.object({
    type: z.literal('quote'),
    text,
    author: short,
    role: short.optional(),
  }),
  z.object({
    type: z.literal('specs'),
    title: short.optional(),
    rows: z.array(z.object({ label: short, value: short })).min(1).max(20),
  }),
  /** Live data: the proposal's items, subtotal, discount and total. */
  z.object({ type: z.literal('pricingTable') }),
  /** Live data: the proposal's notes, when it has any. */
  z.object({ type: z.literal('notes') }),
  /** Live data: the proposal's terms. */
  z.object({ type: z.literal('terms') }),
  z.object({
    type: z.literal('paymentSchedule'),
    title: short.optional(),
    rows: z.array(z.object({ label: short, percent: z.number().min(1).max(100) })).min(1).max(8),
  }),
  z.object({ type: z.literal('contactCard') }),
  z.object({
    type: z.literal('signature'),
    leftLabel: short,
    rightLabel: short,
  }),
]);
export type ProposalBlock = z.infer<typeof proposalBlockSchema>;
export type ProposalBlockType = ProposalBlock['type'];

export const templatePageSchema = z.object({
  id: z.string().min(1).max(60),
  kind: proposalPageKindSchema,
  /** Cover and thank-you pages pick a layout; other kinds ignore it. */
  layout: z.enum(['hero', 'split', 'minimal']).default('hero'),
  /** Full-bleed picture for cover and thank-you pages. */
  image: url.optional(),
  /** The big line on a cover or thank-you page. */
  headline: short.optional(),
  subline: text.optional(),
  /** Small header above the blocks of a content page. */
  title: short.optional(),
  blocks: z.array(proposalBlockSchema).max(30).default([]),
});
export type ProposalPageDef = z.infer<typeof templatePageSchema>;

export const proposalTemplateSchema = z.object({
  /** Stable key for built-ins (`modern-modular`); a generated id for custom templates. */
  key: z.string().min(1).max(60),
  name: short,
  description: text,
  theme: proposalThemeSchema,
  logo: url,
  pages: z.array(templatePageSchema).min(1).max(30),
});
export type ProposalTemplate = z.infer<typeof proposalTemplateSchema>;

/** The values a token can take. Anything else is left as written so a typo is visible. */
export const PROPOSAL_TOKENS = [
  'client.name',
  'client.city',
  'client.address',
  'proposal.number',
  'proposal.title',
  'proposal.date',
  'proposal.validUntil',
  'total',
  'preparedBy',
  'company.name',
  'company.phone',
  'company.address',
] as const;
export type ProposalToken = (typeof PROPOSAL_TOKENS)[number];
