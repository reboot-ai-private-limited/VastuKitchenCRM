import type { ChangeLeadStatusBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { scopeFor } from '@/shared/access/scope.js';
import type { LeadPatch } from '../../domain/lead.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadEventsPort } from '../../domain/leadEvents.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import type { LeadView, LeadViewBuilder } from '../services/leadViews.js';

/**
 * Any status can move to any other. Every change is logged and resets `statusChangedAt`.
 * Won: finds-or-creates the CUSTOMER account, stores it on the lead, and announces `lead.won`. The
 * first win makes the project. Later wins make another only when the lead was deliberately started
 * again for a new project (`newProjectRequested`), so moving a Won lead away and back never makes a
 * second project by accident.
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
    // A won lead has a customer account and a project behind it. Only someone who sees every lead
    // (the Admin) may move it back; the project is NOT deleted when they do.
    if (lead.status === 'WON' && scopeFor(actor.role, 'leads') === 'assigned') {
      throw AppError.forbidden('This lead is won. Ask an admin if its status needs to change.');
    }
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
    let again = false;
    if (input.status === 'WON' && lead.customerId === null) {
      const customer = await this.directory.ensureCustomer({ name: lead.name, phone: lead.phone });
      patch.customerId = customer.id;
      announce = true;
    } else if (input.status === 'WON' && lead.newProjectRequested) {
      announce = true;
      again = true;
    }
    // Won consumes the request: the next project needs a new "start again".
    if (input.status === 'WON') patch.newProjectRequested = false;

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
        ...(again ? { again: true } : {}),
      });
    }

    const [view] = await this.views.build([updated]);
    return view!;
  }
}
