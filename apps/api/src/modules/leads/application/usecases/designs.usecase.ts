import {
  CLOSED_LEAD_STATUSES,
  MAX_MEDIA_PER_VISIT,
  type CompleteLeadDesignBodyDto,
  type UploadTicketDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isInFolder, leadDesignFolder } from '@/shared/storage/folders.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type {
  LeadDesign,
  LeadDesignMedia,
  LeadDesignRepositoryPort,
} from '../../domain/design.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { LeadEventsPort } from '../../domain/leadEvents.port.js';
import type { LeadRepositoryPort } from '../../domain/lead.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import { nameMap } from '../services/leadViews.js';

export interface LeadDesignView {
  design: LeadDesign;
  userName: string;
}

/** Issues a signed ticket to upload design images, videos, or PDFs/files for a lead. */
export class SignLeadDesignUploadUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly storage: StoragePort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<UploadTicketDto> {
    await this.access.load(leadId, actor);
    return this.storage.signFileUpload(leadDesignFolder(this.storage.rootFolder, leadId));
  }
}

/**
 * Designer Team Leader (or Admin) uploads design deliverables (images, videos, drawings/PDFs)
 * and marks the lead's design completed (`DESIGN_ESTIMATE_DONE`).
 */
export class CompleteLeadDesignUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly leads: LeadRepositoryPort,
    private readonly designs: LeadDesignRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly events: LeadEventsPort,
    private readonly storage: StoragePort,
    private readonly maxMedia: number = MAX_MEDIA_PER_VISIT,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actor: Actor,
    leadId: string,
    input: CompleteLeadDesignBodyDto,
  ): Promise<LeadDesignView> {
    const lead = await this.access.load(leadId, actor);
    if ((input.media?.length ?? 0) > this.maxMedia) {
      throw AppError.badRequest(
        `At most ${this.maxMedia} design files can be attached per submission.`,
      );
    }

    const folder = leadDesignFolder(this.storage.rootFolder, leadId);
    const media: LeadDesignMedia[] = (input.media ?? []).map((m) => {
      if (!isInFolder(m.publicId, folder)) {
        throw AppError.badRequest('One of the uploaded files does not belong to this lead.');
      }
      return {
        kind: m.kind,
        publicId: m.publicId,
        fileName: m.fileName ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
        bytes: m.bytes ?? null,
        durationSec: m.durationSec ?? null,
        resourceType: m.resourceType ?? null,
        format: m.format ?? null,
      };
    });

    const now = this.now();
    const design = await this.designs.create({
      leadId,
      userId: actor.id,
      at: now,
      note: input.note ?? null,
      media,
    });

    // Advance lead status to DESIGN_ESTIMATE_DONE if it is not already closed or past design.
    if (!CLOSED_LEAD_STATUSES.includes(lead.status) && lead.status !== 'DESIGN_ESTIMATE_DONE') {
      await this.leads.update(leadId, {
        status: 'DESIGN_ESTIMATE_DONE',
        statusChangedAt: now,
      });
    }

    await this.activities.add({
      leadId,
      type: 'DESIGN_COMPLETED',
      byUserId: actor.id,
      at: now,
      data: {
        from: lead.status,
        to: 'DESIGN_ESTIMATE_DONE',
        note: design.note,
        mediaCount: design.media.length,
      },
    });

    const names = await nameMap(this.directory, [actor.id]);
    const designerName = names.get(actor.id) ?? 'Designer';
    this.events.leadDesignCompleted?.({
      leadId: lead.id,
      leadName: lead.name,
      assignedToId: lead.assignedToId,
      designerName,
      mediaCount: design.media.length,
      byUserId: actor.id,
    });

    return { design, userName: designerName };
  }
}

export class ListLeadDesignsUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly designs: LeadDesignRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<LeadDesignView[]> {
    await this.access.load(leadId, actor);
    const items = await this.designs.listByLead(leadId);
    const names = await nameMap(
      this.directory,
      items.map((d) => d.userId),
    );
    return items.map((design) => ({ design, userName: names.get(design.userId) ?? '' }));
  }
}
