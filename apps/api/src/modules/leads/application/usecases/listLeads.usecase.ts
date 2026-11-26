import { DESIGN_VISIBLE_LEAD_STATUSES, type ListLeadsQueryDto } from '@vastu/contracts';
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
    // Designers see leads from measurement-done onwards (not scoped by sales assignee).
    const isDesigner = actor.role === 'DESIGNER';
    const scoped = !isDesigner && scopeFor(actor.role, 'leads') === 'assigned';
    let assignedToId: string | null | undefined;
    if (scoped || query.assignedTo === 'me') assignedToId = actor.id;
    else if (query.assignedTo === 'unassigned') assignedToId = null;
    else assignedToId = query.assignedTo;

    if (isDesigner && query.status && !DESIGN_VISIBLE_LEAD_STATUSES.includes(query.status)) {
      return { items: [], total: 0 };
    }

    const { items, total } = await this.leads.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
      statuses: isDesigner && !query.status ? DESIGN_VISIBLE_LEAD_STATUSES : undefined,
      source: query.source,
      product: query.product,
      assignedToId,
      stuckBefore:
        query.stuck === true
          ? new Date(this.now().getTime() - (await this.stuckDays()) * 86_400_000)
          : undefined,
      excludeLost: query.excludeLost === true && !query.status ? true : undefined,
    });
    return { items: await this.views.build(items), total };
  }
}
