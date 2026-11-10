import type { Actor, LeadAccess } from '../services/leadAccess.js';
import type { LeadView, LeadViewBuilder } from '../services/leadViews.js';

export class GetLeadUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly views: LeadViewBuilder,
  ) {}

  async execute(actor: Actor, id: string): Promise<LeadView> {
    const lead = await this.access.load(id, actor);
    const [view] = await this.views.build([lead]);
    return view!;
  }
}
