import type { ListLeadsQueryDto } from '@vastu/contracts';
import { scopeFor } from '@/shared/access/scope.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { Actor } from '../services/leadAccess.js';
import type { LeadView, LeadViewBuilder } from '../services/leadViews.js';

export class ListLeadsUseCase {
  constructor(
    private readonly leads: LeadRepositoryPort,
    private readonly views: LeadViewBuilder,
    private readonly stuckDays: () => Promise<number>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actor: Actor,
    query: ListLeadsQueryDto,
  ): Promise<{ items: LeadView[]; total: number }> {
    // Whatever was asked for, someone limited to "assigned" only ever sees their own leads.
    const scoped = scopeFor(actor.role, 'leads') === 'assigned';
    let assignedToId: string | null | undefined;
    if (scoped || query.assignedTo === 'me') assignedToId = actor.id;
    else if (query.assignedTo === 'unassigned') assignedToId = null;
    else assignedToId = query.assignedTo;

    const { items, total } = await this.leads.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      source: query.source,
      assignedToId,
      stuckBefore:
        query.stuck === true
          ? new Date(this.now().getTime() - (await this.stuckDays()) * 86_400_000)
          : undefined,
    });
    return { items: await this.views.build(items), total };
  }
}
