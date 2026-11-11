import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import { nameMap } from '../services/leadViews.js';

export interface JourneyEntry {
  id: string;
  type: string;
  at: Date;
  byUserId: string | null;
  byName: string | null;
  data: Record<string, unknown>;
}

/** A project was created for, or finished for, this lead: the lead's story continues past the win. */
export class RecordProjectEventUseCase {
  constructor(
    private readonly activities: LeadActivityRepositoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    leadId: string,
    event: {
      type: 'PROJECT_CREATED' | 'PROJECT_CLOSED';
      projectName: string;
      byUserId: string | null;
    },
  ): Promise<void> {
    await this.activities.add({
      leadId,
      type: event.type,
      byUserId: event.byUserId,
      at: this.now(),
      data: { projectName: event.projectName },
    });
  }
}

/**
 * The lead's whole story, OLDEST FIRST, for the project page's collapsed "Lead journey". Visible
 * only to someone who may access the lead (the Admin, and the Sales person who owns it); anyone
 * else gets NOT FOUND from `LeadAccess`.
 */
export class GetLeadJourneyUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<JourneyEntry[]> {
    await this.access.load(leadId, actor);
    const items = (await this.activities.listByLead(leadId)).reverse(); // repository is newest first
    const names = await nameMap(
      this.directory,
      items.map((a) => a.byUserId),
    );
    return items.map((a) => ({
      id: a.id,
      type: a.type,
      at: a.at,
      byUserId: a.byUserId,
      byName: a.byUserId ? (names.get(a.byUserId) ?? null) : null,
      data: a.data,
    }));
  }
}
