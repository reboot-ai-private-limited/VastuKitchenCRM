import type { ProposalDto, PublicProposalDto } from '@vastu/contracts';
import { COMPANY_PROFILE } from '@/config/company.js';
import type { PublicProposalView } from '../application/usecases/publicProposal.usecase.js';
import type { ProposalView } from '../application/services/proposalSupport.js';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toProposalDto({
  proposal: p,
  createdByName,
  publicUrl,
}: ProposalView): ProposalDto {
  return {
    id: p.id,
    number: p.number,
    status: p.status,
    leadId: p.leadId,
    customer: p.customer,
    title: p.title,
    items: p.items,
    subtotal: p.subtotal,
    discount: p.discount,
    total: p.total,
    notes: p.notes,
    terms: p.terms,
    validUntil: iso(p.validUntil),
    publicUrl,
    sentAt: iso(p.sentAt),
    firstSeenAt: iso(p.firstSeenAt),
    lastSeenAt: iso(p.lastSeenAt),
    seenCount: p.seenCount,
    createdBy: createdByName ? { id: p.createdById, name: createdByName } : null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** The customer-facing shape: nothing internal (no ids, no staff phone numbers). */
export function toPublicProposalDto({
  proposal: p,
  isExpired,
  sentByName,
}: PublicProposalView): PublicProposalDto {
  return {
    number: p.number,
    title: p.title,
    issuedAt: (p.sentAt ?? p.createdAt).toISOString(),
    validUntil: iso(p.validUntil),
    isExpired,
    customer: { name: p.customer.name, city: p.customer.city, siteAddress: p.customer.siteAddress },
    items: p.items,
    subtotal: p.subtotal,
    discount: p.discount,
    total: p.total,
    notes: p.notes,
    terms: p.terms,
    company: {
      name: COMPANY_PROFILE.name,
      tagline: COMPANY_PROFILE.tagline,
      address: COMPANY_PROFILE.address,
      phone: COMPANY_PROFILE.phone,
    },
    sentBy: sentByName ? { name: sentByName } : null,
  };
}
