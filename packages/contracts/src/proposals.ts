import { z } from 'zod';
import { paginatedSchema } from './pagination.js';
import { proposalTemplateSchema } from './proposalTemplates.js';

export const PROPOSAL_STATUSES = ['DRAFT', 'SENT'] as const;
export const proposalStatusSchema = z.enum(PROPOSAL_STATUSES);
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export const MAX_PROPOSAL_ITEMS = 50;

/** Whole rupees everywhere: no paise, so no floating-point rounding in totals. */
const rupees = z.number().int().min(0).max(1_000_000_000);

export const proposalItemInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000).optional(),
  quantity: z.number().positive().max(100_000),
  unitPrice: rupees,
});
export type ProposalItemInputDto = z.infer<typeof proposalItemInputSchema>;

export const proposalItemSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number().int(),
  /** `round(quantity × unitPrice)`, in rupees. */
  lineTotal: z.number().int(),
});
export type ProposalItemDto = z.infer<typeof proposalItemSchema>;

const proposalFields = {
  title: z.string().trim().min(1).max(200),
  siteAddress: z.string().trim().min(1).max(500),
  items: z.array(proposalItemInputSchema).min(1).max(MAX_PROPOSAL_ITEMS),
  /** A flat amount in rupees, not more than the subtotal. */
  discount: rupees,
  notes: z.string().trim().min(1).max(2000),
  /** Replaces the default terms for this proposal. */
  terms: z.string().trim().min(1).max(5000),
  validUntil: z.coerce.date(),
};

export const createProposalBodySchema = z.object({
  leadId: z.string().min(1),
  title: proposalFields.title.default('Modular kitchen proposal'),
  siteAddress: proposalFields.siteAddress.optional(),
  items: proposalFields.items,
  discount: proposalFields.discount.default(0),
  notes: proposalFields.notes.optional(),
  terms: proposalFields.terms.optional(),
  validUntil: proposalFields.validUntil.optional(),
  /** A template key (built-in or custom). Omitted: the default template. */
  templateKey: z.string().min(1).max(60).optional(),
});
export type CreateProposalBodyDto = z.infer<typeof createProposalBodySchema>;

/** Drafts only. `null` clears an optional field; omit a key to leave it alone. */
export const updateProposalBodySchema = z
  .object({
    title: proposalFields.title,
    siteAddress: proposalFields.siteAddress.nullable(),
    items: proposalFields.items,
    discount: proposalFields.discount,
    notes: proposalFields.notes.nullable(),
    terms: proposalFields.terms,
    validUntil: proposalFields.validUntil.nullable(),
    /** Drafts only: re-snapshots the chosen template into the proposal. */
    templateKey: z.string().min(1).max(60),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateProposalBodyDto = z.infer<typeof updateProposalBodySchema>;

export const proposalIdParamsSchema = z.object({ id: z.string().min(1) });
export const proposalTokenParamsSchema = z.object({ token: z.string().min(16).max(200) });

export const listProposalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  leadId: z.string().min(1).optional(),
  status: proposalStatusSchema.optional(),
});
export type ListProposalsQueryDto = z.infer<typeof listProposalsQuerySchema>;

export const proposalSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: proposalStatusSchema,
  leadId: z.string(),
  customer: z.object({
    name: z.string(),
    phone: z.string(),
    city: z.string().nullable(),
    siteAddress: z.string().nullable(),
  }),
  title: z.string(),
  items: z.array(proposalItemSchema),
  subtotal: z.number().int(),
  discount: z.number().int(),
  total: z.number().int(),
  notes: z.string().nullable(),
  terms: z.string(),
  /** The template this proposal was made with, and a snapshot of it: later edits to the template never change a sent proposal. */
  templateKey: z.string(),
  template: proposalTemplateSchema,
  validUntil: z.string().nullable(),
  /** Present once the proposal has been sent. */
  publicUrl: z.string().nullable(),
  sentAt: z.string().nullable(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  seenCount: z.number().int(),
  createdBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});
export type ProposalDto = z.infer<typeof proposalSchema>;

export const proposalPageSchema = paginatedSchema(proposalSchema);

export const sendProposalResponseSchema = z.object({
  proposal: proposalSchema,
  /** The link to share. Identical every time this proposal is sent. */
  publicUrl: z.string(),
  /** Opens WhatsApp with the customer's number and a ready message. */
  whatsappUrl: z.string(),
});
export type SendProposalResponseDto = z.infer<typeof sendProposalResponseSchema>;

/** What the customer's page shows. Deliberately small: nothing internal. */
export const publicProposalSchema = z.object({
  number: z.string(),
  title: z.string(),
  issuedAt: z.string(),
  validUntil: z.string().nullable(),
  isExpired: z.boolean(),
  customer: z.object({
    name: z.string(),
    city: z.string().nullable(),
    siteAddress: z.string().nullable(),
  }),
  items: z.array(proposalItemSchema),
  subtotal: z.number().int(),
  discount: z.number().int(),
  total: z.number().int(),
  notes: z.string().nullable(),
  terms: z.string(),
  template: proposalTemplateSchema,
  company: z.object({
    name: z.string(),
    tagline: z.string(),
    address: z.string(),
    phone: z.string(),
  }),
  /** Name only; no staff phone numbers on a public page. */
  sentBy: z.object({ name: z.string() }).nullable(),
});
export type PublicProposalDto = z.infer<typeof publicProposalSchema>;

export const seenResponseSchema = z.object({});
