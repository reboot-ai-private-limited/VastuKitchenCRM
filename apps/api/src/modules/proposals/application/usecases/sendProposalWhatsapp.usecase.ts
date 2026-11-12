import type { SendProposalWhatsappBodyDto } from '@vastu/contracts';
import type { ActorRef } from '../../domain/leadsGateway.port.js';
import type { ProposalMessengerPort } from '../../domain/proposalMessenger.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { ProposalSettingsPort } from '../../domain/settings.port.js';
import type { ProposalViewBuilder } from '../services/proposalSupport.js';
import type { SendProposalUseCase, SendResult } from './sendProposal.usecase.js';

export interface WhatsappSendResult extends SendResult {
  sentTo: string;
  delivery: 'sent' | 'not_configured';
}

/**
 * Freezes a draft (like "Send"), then sends the customer the link as a WhatsApp template message.
 * The message goes to `phone` when given, otherwise to the number on the proposal (the lead's). A
 * different number only changes where THIS message goes: the lead and the proposal keep their own.
 * If WhatsApp is not set up the proposal is still frozen and the caller gets the manual link.
 */
export class SendProposalWhatsappUseCase {
  constructor(
    private readonly send: SendProposalUseCase,
    private readonly proposals: ProposalRepositoryPort,
    private readonly messenger: ProposalMessengerPort,
    private readonly settings: ProposalSettingsPort,
    private readonly views: ProposalViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actor: ActorRef,
    id: string,
    input: SendProposalWhatsappBodyDto,
  ): Promise<WhatsappSendResult> {
    const frozen = await this.send.execute(actor, id);
    const proposal = frozen.view.proposal;
    const to = input.phone ?? proposal.customer.phone;

    if (!this.messenger.configured) {
      return { ...frozen, sentTo: to, delivery: 'not_configured' };
    }

    const company = await this.settings.company();
    const { messageId } = await this.messenger.sendLink({
      to,
      firstName: proposal.customer.name.split(/\s+/)[0] ?? proposal.customer.name,
      number: proposal.number,
      companyName: company.name,
      token: proposal.token,
      // One confirm click = one message: a double click or a retry with the same id sends once.
      ...(input.requestId ? { idempotencyKey: `proposal-${proposal.id}-${input.requestId}` } : {}),
    });

    const updated = await this.proposals.recordWhatsappSend(proposal.id, {
      to,
      at: this.now(),
      byId: actor.id,
      messageId,
    });
    const [view] = await this.views.build([updated ?? proposal]);
    return { ...frozen, view: view!, sentTo: to, delivery: 'sent' };
  }
}
