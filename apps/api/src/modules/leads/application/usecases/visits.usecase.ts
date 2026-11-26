import { MAX_MEDIA_PER_VISIT, type RecordVisitBodyDto, type UploadTicketDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isInFolder, leadVisitsFolder } from '@/shared/storage/folders.js';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type { Visit, VisitMedia } from '../../domain/visit.entity.js';
import type { LeadActivityRepositoryPort } from '../../domain/leadActivity.repository.port.js';
import type { UserDirectoryPort } from '../../domain/userDirectory.port.js';
import type { VisitRepositoryPort } from '../../domain/visit.repository.port.js';
import type { Actor, LeadAccess } from '../services/leadAccess.js';
import { nameMap } from '../services/leadViews.js';

export interface VisitView {
  visit: Visit;
  userName: string;
}

/** Issues a signed ticket to upload photos or videos for a lead's measurement/site visit. */
export class SignVisitMediaUploadUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly storage: StoragePort,
  ) {}

  async execute(actor: Actor, leadId: string): Promise<UploadTicketDto> {
    await this.access.load(leadId, actor);
    return this.storage.signFileUpload(leadVisitsFolder(this.storage.rootFolder, leadId));
  }
}

/** A site/measurement visit check-in. Allowed on any lead, before a proposal and after it is Won. */
export class RecordVisitUseCase {
  constructor(
    private readonly access: LeadAccess,
    private readonly visits: VisitRepositoryPort,
    private readonly activities: LeadActivityRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly storage?: StoragePort,
    private readonly maxMedia: number = MAX_MEDIA_PER_VISIT,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: Actor, leadId: string, input: RecordVisitBodyDto): Promise<VisitView> {
    await this.access.load(leadId, actor);
    if ((input.media?.length ?? 0) > this.maxMedia) {
      throw AppError.badRequest(
        `At most ${this.maxMedia} photos/videos can be attached to one visit.`,
      );
    }
    const folder = this.storage ? leadVisitsFolder(this.storage.rootFolder, leadId) : null;
    const media: VisitMedia[] = (input.media ?? []).map((m) => {
      if (folder && !isInFolder(m.publicId, folder)) {
        throw AppError.badRequest('One of the uploaded files does not belong to this lead.');
      }
      return {
        kind: m.kind,
        publicId: m.publicId,
        width: m.width ?? null,
        height: m.height ?? null,
        bytes: m.bytes ?? null,
        durationSec: m.durationSec ?? null,
      };
    });

    const at = input.at ?? this.now();
    const visit = await this.visits.create({
      leadId,
      userId: actor.id,
      at,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      note: input.note ?? null,
      photoUrl: input.photoUrl ?? null,
      media,
    });
    await this.activities.add({
      leadId,
      type: 'VISIT',
      byUserId: actor.id,
      at,
      data: {
        note: visit.note,
        latitude: visit.latitude,
        longitude: visit.longitude,
        mediaCount: visit.media.length,
      },
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
