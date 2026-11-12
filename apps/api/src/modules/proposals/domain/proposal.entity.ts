import {
  DEFAULT_PROPOSAL_TEMPLATE_KEY,
  findBuiltinTemplate,
  type ProposalItemInputDto,
  type ProposalStatus,
  type ProposalTemplate,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';

export interface ProposalItem {
  title: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  /** `round(quantity × unitPrice)`, whole rupees. */
  lineTotal: number;
}

/** Copied from the lead when the proposal is made, so later lead edits cannot change what was sent. */
export interface CustomerSnapshot {
  name: string;
  phone: string;
  city: string | null;
  siteAddress: string | null;
}

export interface Proposal {
  id: string;
  /** `VK-2026-0001`. */
  number: string;
  leadId: string;
  status: ProposalStatus;
  customer: CustomerSnapshot;
  title: string;
  items: ProposalItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  terms: string;
  /** The template chosen, and a frozen copy of it: editing or deleting the template never changes this proposal. */
  templateKey: string;
  template: ProposalTemplate;
  validUntil: Date | null;
  /** Unguessable; the public link is built from it. Stored as-is so the SAME link can be resent. */
  token: string;
  sentAt: Date | null;
  sentById: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
  seenCount: number;
  createdById: string;
  createdAt: Date;
}

export type NewProposal = Omit<Proposal, 'id' | 'createdAt'>;

export type ProposalPatch = Partial<
  Pick<
    Proposal,
    | 'title'
    | 'customer'
    | 'items'
    | 'subtotal'
    | 'discount'
    | 'total'
    | 'notes'
    | 'terms'
    | 'validUntil'
    | 'templateKey'
    | 'template'
  >
>;

export function buildItems(inputs: ProposalItemInputDto[]): ProposalItem[] {
  return inputs.map((i) => ({
    title: i.title,
    description: i.description ?? null,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: Math.round(i.quantity * i.unitPrice),
  }));
}

/** Subtotal and total in whole rupees. The discount may not exceed the subtotal. */
export function computeTotals(
  items: ProposalItem[],
  discount: number,
): { subtotal: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  if (discount > subtotal) {
    throw AppError.badRequest('The discount cannot be more than the subtotal.', [
      { path: ['discount'], message: 'More than the subtotal' },
    ]);
  }
  return { subtotal, total: subtotal - discount };
}

const DAY_MS = 86_400_000;

/** `validUntil` is a calendar date, valid through the end of that day. */
export function isExpired(validUntil: Date | null, now: Date): boolean {
  return validUntil !== null && now.getTime() >= validUntil.getTime() + DAY_MS;
}

export function assertNotInPast(validUntil: Date | undefined | null, now: Date): void {
  if (validUntil && isExpired(validUntil, now)) {
    throw AppError.badRequest('The valid-until date is in the past.', [
      { path: ['validUntil'], message: 'Must not be in the past' },
    ]);
  }
}

/**
 * Proposals made before templates existed carry none. They read as the default built-in template,
 * so old links keep working with no data migration.
 */
export function templateOrDefault(
  key: string | null | undefined,
  template: ProposalTemplate | null | undefined,
): { templateKey: string; template: ProposalTemplate } {
  if (key && template) return { templateKey: key, template };
  return {
    templateKey: DEFAULT_PROPOSAL_TEMPLATE_KEY,
    template: findBuiltinTemplate(DEFAULT_PROPOSAL_TEMPLATE_KEY)!,
  };
}
