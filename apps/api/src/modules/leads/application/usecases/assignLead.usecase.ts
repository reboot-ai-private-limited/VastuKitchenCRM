import type { AssignLeadBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { LeadEventsPort } from '../../domain/leadEvents.port.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor } from '../services/leadAccess.js';
import type { LeadView, LeadViewBuilder } from '../services/leadViews.js';

export class AssignLeadUseCase {
  constructor(
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly events: LeadEventsPort,
    private readonly views: LeadViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, id: string, input: AssignLeadBodyDto): Promise<LeadView> {
    const lead = await this.leads.findById(id);
    if (!lead) throw AppError.notFound('Lead not found.');

    let assigneeName: string | null = null;
    if (input.userId !== null) {
      const [user] = await this.directory.find([input.userId]);
      if (!user || user.role !== 'SALES') {
        throw AppError.badRequest('Leads can only be assigned to a sales person.', [
          { path: ['userId'], message: 'Not a sales user' },
        ]);
      }
      assigneeName = user.name;
    }

    // Captured first: a repository may hand back a live object that the update below mutates.
    const previousAssigneeId = lead.assignedToId;
    const updated = await this.leads.update(id, { assignedToId: input.userId });
    if (!updated) throw AppError.notFound('Lead not found.');
    await this.activities.add({
      leadId: id,
      type: 'ASSIGNED',
      byUserId: actor.id,
      at: this.now(),
      data: { from: previousAssigneeId, to: input.userId, toName: assigneeName },
    });
    // Tell whoever listens (the new assignee gets a notification). Only on a real change.
    if (previousAssigneeId !== input.userId) {
      this.events.leadAssigned({
        leadId: id,
        leadName: updated.name,
        leadPhone: updated.phone,
        toUserId: input.userId,
        byUserId: actor.id,
      });
    }
    const [view] = await this.views.build([updated]);
    return view!;
  }
}
