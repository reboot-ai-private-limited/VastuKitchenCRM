import type { UpdateLeadBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { LeadPatch } from '../../domain/lead.entity.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import type { LeadView, LeadViewBuilder } from '../services/leadViews.js';

/** Edits contact details. Status and assignment have their own use cases (they leave a trail). */
export class UpdateLeadUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly leads: LeadRepositoryPort,
    private readonly views: LeadViewBuilder,
  ) {}

  async execute(actor: Actor, id: string, input: UpdateLeadBodyDto): Promise<LeadView> {
    const current = await this.access.load(id, actor);

    if (input.phone !== undefined && input.phone !== current.phone) {
      const clash = await this.leads.findByPhone(input.phone);
      if (clash && clash.id !== id) {
        throw AppError.conflict('A lead with this phone number already exists.', {
          existingLeadId: clash.id,
        });
      }
    }

    const patch: LeadPatch = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.altPhone !== undefined) patch.altPhone = input.altPhone;
    if (input.email !== undefined) patch.email = input.email;
    if (input.city !== undefined) patch.city = input.city;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.source !== undefined) patch.source = input.source;

    const updated = await this.leads.update(id, patch);
    if (!updated) throw AppError.notFound('Lead not found.');
    const [view] = await this.views.build([updated]);
    return view!;
  }
}
