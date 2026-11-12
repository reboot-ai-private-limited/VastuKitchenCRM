import { type CreateProposalBodyDto } from '@vastu/contracts';
import {
  assertNotInPast,
  buildItems,
  computeTotals,
  type Proposal,
} from '../../domain/proposal.entity.js';
import type { ActorRef, LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { NumberSequencePort } from '../../domain/numberSequence.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { PublicTokenPort } from '../../domain/publicToken.port.js';
import type { ProposalSettingsPort } from '../../domain/settings.port.js';
import type { TemplateResolver } from '../services/templateResolver.js';

export function formatNumber(year: number, seq: number): string {
  return `VK-${year}-${String(seq).padStart(4, '0')}`;
}

export class CreateProposalUseCase {
  constructor(
    private readonly proposals: ProposalRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly numbers: NumberSequencePort,
    private readonly tokens: PublicTokenPort,
    private readonly settings: ProposalSettingsPort,
    private readonly templates: TemplateResolver,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, input: CreateProposalBodyDto): Promise<Proposal> {
    const lead = await this.leads.getLead(actor, input.leadId);
    const now = this.now();
    assertNotInPast(input.validUntil, now);

    const chosen = await this.templates.resolve(input.templateKey);
    const items = buildItems(input.items);
    const { subtotal, total } = computeTotals(items, input.discount);

    return this.proposals.create({
      number: formatNumber(now.getFullYear(), await this.numbers.next(now.getFullYear())),
      leadId: lead.id,
      status: 'DRAFT',
      customer: {
        name: lead.name,
        phone: lead.phone,
        city: lead.city,
        siteAddress: input.siteAddress ?? null,
      },
      title: input.title,
      items,
      subtotal,
      discount: input.discount,
      total,
      notes: input.notes ?? null,
      terms: input.terms ?? (await this.settings.defaultTerms()),
      templateKey: chosen.key,
      template: chosen.template,
      validUntil: input.validUntil ?? null,
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
