import type { LeadActivity } from '../../domain/leadActivity.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import { nameMap } from '../services/leadViews.js';

export interface ActivityView {
  activity: LeadActivity;
  byName: string | null;
}

export class GetLeadTimelineUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<ActivityView[]> {
    await this.access.load(leadId, actor);
    const items = await this.activities.listByLead(leadId);
    const names = await nameMap(
      this.directory,
      items.map((a) => a.byUserId),
    );
    return items.map((activity) => ({
      activity,
      byName: activity.byUserId ? (names.get(activity.byUserId) ?? null) : null,
    }));
  }
}
