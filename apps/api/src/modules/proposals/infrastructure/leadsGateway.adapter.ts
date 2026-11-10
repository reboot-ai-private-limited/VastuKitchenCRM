import type { LeadsPublicContract } from '@/modules/leads/leads.public.js';
import type { ActorRef, LeadInfo, LeadsGatewayPort } from '../domain/leadsGateway.port.js';

/** Proposals' only door into leads: its public contract. */
export class LeadsGateway implements LeadsGatewayPort {
  constructor(private readonly leads: LeadsPublicContract) {}

  async getLead(actor: ActorRef, leadId: string): Promise<LeadInfo> {
    const lead = await this.leads.getLeadForProposal(actor, leadId);
    return { id: lead.id, name: lead.name, phone: lead.phone, city: lead.city };
  }

  recordSent(actor: ActorRef, leadId: string, number: string): Promise<void> {
    return this.leads.recordProposalSent(actor, leadId, { number });
  }

  recordSeen(leadId: string, number: string): Promise<void> {
    return this.leads.recordProposalSeen(leadId, { number });
  }
}
