import type { ActorRef, LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { NumberSequencePort } from '../../domain/numberSequence.port.js';
import { type Proposal } from '../../domain/proposal.entity.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { PublicTokenPort } from '../../domain/publicToken.port.js';
import type { ProposalAccess } from '../services/proposalSupport.js';
import { formatNumber } from './createProposal.usecase.js';

/**
 * A sent proposal is frozen, so "change the price" means: copy it into a new DRAFT with a new
 * number and a new link. The customer's data is refreshed from the lead; the validity date is not
 * carried over (it would usually already be past).
 */
export class DuplicateProposalUseCase {
  constructor(
    private readonly access: ProposalAccess,
    private readonly proposals: ProposalRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly numbers: NumberSequencePort,
    private readonly tokens: PublicTokenPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, id: string): Promise<Proposal> {
    const source = await this.access.load(id, actor);
    const lead = await this.leads.getLead(actor, source.leadId);
    const year = this.now().getFullYear();

    return this.proposals.create({
      number: formatNumber(year, await this.numbers.next(year)),
      leadId: source.leadId,
      status: 'DRAFT',
      customer: {
        name: lead.name,
        phone: lead.phone,
        city: lead.city,
        siteAddress: source.customer.siteAddress,
      },
      title: source.title,
      items: source.items,
      subtotal: source.subtotal,
      discount: source.discount,
      total: source.total,
      notes: source.notes,
      terms: source.terms,
      templateKey: source.templateKey,
      template: source.template,
      validUntil: null,
      token: this.tokens.generate(),
      sentAt: null,
      sentById: null,
      firstSeenAt: null,
      lastSeenAt: null,
      seenCount: 0,
      createdById: actor.id,
    });
  }
}
