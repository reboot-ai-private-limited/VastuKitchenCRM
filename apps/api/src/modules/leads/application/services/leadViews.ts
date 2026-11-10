import type { Lead } from '../../domain/lead.entity.js';
import { isStuck } from '../../domain/lead.entity.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';

export interface LeadView {
  lead: Lead;
  assigneeName: string | null;
  isStuck: boolean;
}

/** Adds the assignee's name and the computed `isStuck` flag to leads. */
export class LeadViewBuilder {
  constructor(
    private readonly directory: UserDirectoryPort,
    private readonly stuckDays: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async build(leads: Lead[]): Promise<LeadView[]> {
    const ids = [
      ...new Set(leads.map((l) => l.assignedToId).filter((id): id is string => id !== null)),
    ];
    const names = new Map((await this.directory.find(ids)).map((u) => [u.id, u.name]));
    const now = this.now();
    return leads.map((lead) => ({
      lead,
      assigneeName: lead.assignedToId ? (names.get(lead.assignedToId) ?? null) : null,
      isStuck: isStuck(lead, this.stuckDays, now),
    }));
  }
}

/** id → name for the people who appear on calls, visits and the timeline. */
export async function nameMap(
  directory: UserDirectoryPort,
  ids: Array<string | null>,
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  return new Map((await directory.find(unique)).map((u) => [u.id, u.name]));
}
