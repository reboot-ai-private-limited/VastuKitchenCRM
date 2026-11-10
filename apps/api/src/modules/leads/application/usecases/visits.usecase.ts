import type { RecordVisitBodyDto } from '@vastu/contracts';
import type { Visit } from '../../domain/visit.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { VisitRepositoryPort } from '../../domain/visit.repository.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import { nameMap } from '../services/leadViews.js';

export interface VisitView {
  visit: Visit;
  userName: string;
}

/** A site/home visit check-in. Allowed on any lead, before a proposal and after it is Won. */
export class RecordVisitUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly visits: VisitRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, leadId: string, input: RecordVisitBodyDto): Promise<VisitView> {
    await this.access.load(leadId, actor);
    const at = input.at ?? this.now();
    const visit = await this.visits.create({
      leadId,
      userId: actor.id,
      at,
      latitude: input.latitude,
      longitude: input.longitude,
      note: input.note ?? null,
      photoUrl: input.photoUrl ?? null,
    });
    await this.activities.add({
      leadId,
      type: 'VISIT',
      byUserId: actor.id,
      at,
      data: { note: visit.note, latitude: visit.latitude, longitude: visit.longitude },
    });
    const names = await nameMap(this.directory, [actor.id]);
    return { visit, userName: names.get(actor.id) ?? '' };
  }
}

export class ListVisitsUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly visits: VisitRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<VisitView[]> {
    await this.access.load(leadId, actor);
    const items = await this.visits.listByLead(leadId);
    const names = await nameMap(
      this.directory,
      items.map((v) => v.userId),
    );
    return items.map((visit) => ({ visit, userName: names.get(visit.userId) ?? '' }));
  }
}
