import type { ChangeLeadStatusBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { LeadPatch } from '../../domain/lead.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadEventsPort } from '../../domain/leadEvents.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import type { LeadView, LeadViewBuilder } from '../services/leadViews.js';

/**
 * Any status can move to any other. Every change is logged and resets `statusChangedAt`.
 * Won: finds-or-creates the CUSTOMER account, stores it on the lead, and announces `lead.won` —
 * once per lead, so moving a Won lead away and back never creates a second project.
 */
export class ChangeLeadStatusUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly leads: LeadRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly events: LeadEventsPort,
    private readonly views: LeadViewBuilder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, id: string, input: ChangeLeadStatusBodyDto): Promise<LeadView> {
    const lead = await this.access.load(id, actor);
    if (lead.status === input.status) {
      throw AppError.badRequest(`This lead is already ${input.status}.`);
    }

    const now = this.now();
    const patch: LeadPatch = {
      status: input.status,
      statusChangedAt: now,
      lostReason: input.status === 'LOST' ? (input.lostReason ?? null) : null,
    };

    let announce = false;
    if (input.status === 'WON' && lead.customerId === null) {
      const customer = await this.directory.ensureCustomer({ name: lead.name, phone: lead.phone });
      patch.customerId = customer.id;
      announce = true;
    }

    const updated = await this.leads.update(id, patch);
    if (!updated) throw AppError.notFound('Lead not found.');

    await this.activities.add({
      leadId: id,
      type: 'STATUS_CHANGED',
      byUserId: actor.id,
      at: now,
      data: {
        from: lead.status,
        to: input.status,
        ...(input.note ? { note: input.note } : {}),
        ...(input.lostReason && input.status === 'LOST' ? { lostReason: input.lostReason } : {}),
      },
    });

    if (announce && updated.customerId) {
      this.events.leadWon({
        leadId: updated.id,
        customerId: updated.customerId,
        name: updated.name,
        phone: updated.phone,
        byUserId: actor.id,
      });
    }

    const [view] = await this.views.build([updated]);
    return view!;
  }
}
