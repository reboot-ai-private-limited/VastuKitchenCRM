import { AppError } from '@/shared/errors/AppError.js';
import { assertNotInPast, type Proposal } from '../../domain/proposal.entity.js';
import type { ActorRef, LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { ProposalSettingsPort } from '../../domain/settings.port.js';
import type {
  ProposalAccess,
  ProposalLinks,
  ProposalView,
  ProposalViewBuilder,
} from '../services/proposalSupport.js';

export interface SendResult {
  view: ProposalView;
  publicUrl: string;
  whatsappUrl: string;
}

/**
 * Marks a draft as sent and returns the shareable link + the prefilled WhatsApp link. Sending an
 * already-sent proposal again just returns the SAME links (a resend), changing nothing — so the
 * link already in the customer's chat keeps working.
 */
export class SendProposalUseCase {
  constructor(
    private readonly access: ProposalAccess,
    private readonly proposals: ProposalRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly links: ProposalLinks,
    private readonly views: ProposalViewBuilder,
    private readonly settings: ProposalSettingsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, id: string): Promise<SendResult> {
    const current = await this.access.load(id, actor);
    let proposal: Proposal = current;

    if (current.status === 'DRAFT') {
      assertNotInPast(current.validUntil, this.now());
      const sent = await this.proposals.markSent(id, this.now(), actor.id);
      if (!sent) {
        // Lost a race with another send of the same draft: that one wins; just reload.
        const reloaded = await this.proposals.findById(id);
        if (!reloaded) throw AppError.notFound('Proposal not found.');
        proposal = reloaded;
      } else {
        proposal = sent;
        // Only the request that really flipped DRAFT → SENT touches the lead.
        await this.leads.recordSent(actor, proposal.leadId, proposal.number);
      }
    }

    const [view] = await this.views.build([proposal]);
    return {
      view: view!,
      publicUrl: this.links.publicUrl(proposal.token),
      whatsappUrl: this.links.whatsappUrl(proposal, (await this.settings.company()).name),
    };
  }
}
