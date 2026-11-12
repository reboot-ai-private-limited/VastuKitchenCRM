import type { Proposal } from '../../domain/proposal.entity.js';
import type { ActorRef, LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import { AppError } from '@/shared/errors/AppError.js';

export interface ProposalView {
  proposal: Proposal;
  createdByName: string | null;
  publicUrl: string | null;
  /** Names of the people on it (creator, WhatsApp senders), by user id. */
  userNames: ReadonlyMap<string, string>;
}

/** Builds the public link and the prefilled WhatsApp message. No I/O, so trivially testable. */
export class ProposalLinks {
  constructor(private readonly webBaseUrl: string) {}

  publicUrl(token: string): string {
    return `${this.webBaseUrl.replace(/\/+$/, '')}/p/${token}`;
  }

  whatsappUrl(proposal: Proposal, companyName: string): string {
    const firstName = proposal.customer.name.split(/\s+/)[0] ?? proposal.customer.name;
    const message =
      `Namaste ${firstName}, here is your proposal ${proposal.number} ` +
      `from ${companyName}: ${this.publicUrl(proposal.token)}`;
    return `https://wa.me/91${proposal.customer.phone}?text=${encodeURIComponent(message)}`;
  }
}

/** Loads a proposal the actor may touch: they must be able to access its lead. */
export class ProposalAccess {
  constructor(
    private readonly proposals: ProposalRepositoryPort,
    private readonly leads: LeadsGatewayPort,
  ) {}

  async load(id: string, actor: ActorRef): Promise<Proposal> {
    const proposal = await this.proposals.findById(id);
    if (!proposal) throw AppError.notFound('Proposal not found.');
    // Reported as NOT FOUND when the lead is out of scope, so ids cannot be probed.
    await this.leads.getLead(actor, proposal.leadId);
    return proposal;
  }
}

export class ProposalViewBuilder {
  constructor(
    private readonly directory: UserDirectoryPort,
    private readonly links: ProposalLinks,
  ) {}

  async build(proposals: Proposal[]): Promise<ProposalView[]> {
    const ids = [
      ...new Set(
        proposals.flatMap((p) => [
          p.createdById,
          ...p.whatsappSends.flatMap((w) => (w.byId ? [w.byId] : [])),
        ]),
      ),
    ];
    const names = new Map((await this.directory.find(ids)).map((u) => [u.id, u.name]));
    return proposals.map((proposal) => ({
      proposal,
      createdByName: names.get(proposal.createdById) ?? null,
      // The link exists only once the proposal has been sent.
      publicUrl: proposal.status === 'SENT' ? this.links.publicUrl(proposal.token) : null,
      userNames: names,
    }));
  }
}
