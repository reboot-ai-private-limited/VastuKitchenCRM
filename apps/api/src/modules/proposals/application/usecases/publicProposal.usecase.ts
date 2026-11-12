import type { RoleName } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isExpired, type Proposal } from '../../domain/proposal.entity.js';
import type { LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { ProposalEventsPort } from '../../domain/proposalEvents.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { CompanyProfile, ProposalSettingsPort } from '../../domain/settings.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';

export interface PublicProposalView {
  proposal: Proposal;
  isExpired: boolean;
  sentByName: string | null;
  /** The company details printed on the page, as set by the Admin right now. */
  company: CompanyProfile;
}

/**
 * What the customer's page needs. Drafts are never public (404). This does NOT record a view:
 * chat apps fetch links to build previews, and that must not count as "seen".
 */
export class GetPublicProposalUseCase {
  constructor(
    private readonly proposals: ProposalRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly settings: ProposalSettingsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(token: string): Promise<PublicProposalView> {
    const proposal = await this.proposals.findByToken(token);
    if (!proposal || proposal.status !== 'SENT') throw AppError.notFound('Proposal not found.');
    const [sender] = proposal.sentById ? await this.directory.find([proposal.sentById]) : [];
    return {
      proposal,
      isExpired: isExpired(proposal.validUntil, this.now()),
      sentByName: sender?.name ?? null,
      company: await this.settings.company(),
    };
  }
}

/** Link-preview fetchers, crawlers and scripts. They normally do not run JS or POST anyway. */
const BOT_AGENT =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|curl\/|wget\/|python-requests|httpclient/i;

/**
 * The customer's browser reports that the page rendered. Counts a view; the FIRST one also writes
 * the lead timeline and announces `proposal.seen` (the sales person's alert). Always harmless to
 * call again: later views only bump the counters. Never reveals whether a token exists.
 */
export class RecordProposalSeenUseCase {
  constructor(
    private readonly proposals: ProposalRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly events: ProposalEventsPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    token: string,
    userAgent: string | undefined,
    viewer?: { id: string; role: RoleName },
  ): Promise<void> {
    if (userAgent && BOT_AGENT.test(userAgent)) return;
    // Staff opening the link (to check it, or just clicking around) is not the customer looking.
    if (viewer && viewer.role !== 'CUSTOMER') return;

    const result = await this.proposals.recordSeen(token, this.now());
    if (!result?.first) return;

    const { proposal } = result;
    await this.leads.recordSeen(proposal.leadId, proposal.number);
    this.events.proposalSeen({
      proposalId: proposal.id,
      leadId: proposal.leadId,
      number: proposal.number,
      sentById: proposal.sentById,
      customerName: proposal.customer.name,
    });
  }
}
