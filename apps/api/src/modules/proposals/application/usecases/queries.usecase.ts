import type { ListProposalsQueryDto } from '@vastu/contracts';
import { scopeFor } from '@/shared/access/scope.js';
import type { ActorRef, LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type {
  ProposalAccess,
  ProposalView,
  ProposalViewBuilder,
} from '../services/proposalSupport.js';

export class GetProposalUseCase {
  constructor(
    private readonly access: ProposalAccess,
    private readonly views: ProposalViewBuilder,
  ) {}

  /** The sales person's own preview. Opening this never counts as the customer seeing it. */
  async execute(actor: ActorRef, id: string): Promise<ProposalView> {
    const [view] = await this.views.build([await this.access.load(id, actor)]);
    return view!;
  }
}

export class ListProposalsUseCase {
  constructor(
    private readonly proposals: ProposalRepositoryPort,
    private readonly leads: LeadsGatewayPort,
    private readonly views: ProposalViewBuilder,
  ) {}

  async execute(
    actor: ActorRef,
    query: ListProposalsQueryDto,
  ): Promise<{ items: ProposalView[]; total: number }> {
    // For one lead: whoever may access the lead may see all its proposals.
    if (query.leadId) await this.leads.getLead(actor, query.leadId);

    const { items, total } = await this.proposals.list({
      page: query.page,
      pageSize: query.pageSize,
      leadId: query.leadId,
      status: query.status,
      // Without a lead filter, someone limited to "assigned" sees only the proposals they made.
      createdById:
        !query.leadId && scopeFor(actor.role, 'proposals') === 'assigned' ? actor.id : undefined,
    });
    return { items: await this.views.build(items), total };
  }
}
