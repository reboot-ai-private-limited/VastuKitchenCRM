import type {
  CallDto,
  CallStatDto,
  LeadActivityDto,
  LeadDesignDto,
  LeadDto,
  VisitDto,
} from '@vastu/contracts';
import type { StoragePort } from '@/shared/storage/storage.port.js';
import type { CallView, CallStatView } from '../application/usecases/calls.usecase.js';
import type { LeadDesignView } from '../application/usecases/designs.usecase.js';
import type { ActivityView } from '../application/usecases/timeline.usecase.js';
import type { VisitView } from '../application/usecases/visits.usecase.js';
import type { LeadView } from '../application/services/leadViews.js';

export const toLeadDto = ({ lead, assigneeName, isStuck }: LeadView): LeadDto => ({
  id: lead.id,
  name: lead.name,
  phone: lead.phone,
  altPhone: lead.altPhone,
  email: lead.email,
  city: lead.city,
  notes: lead.notes,
  productsOfInterest: lead.productsOfInterest,
  source: lead.source,
  status: lead.status,
  statusChangedAt: lead.statusChangedAt.toISOString(),
  isStuck,
  assignedTo:
    lead.assignedToId && assigneeName ? { id: lead.assignedToId, name: assigneeName } : null,
  lostReason: lead.lostReason,
  customerId: lead.customerId,
  createdAt: lead.createdAt.toISOString(),
});

export const toCallDto = ({ call, userName }: CallView): CallDto => ({
  id: call.id,
  leadId: call.leadId,
  user: { id: call.userId, name: userName },
  startedAt: call.startedAt.toISOString(),
  durationSec: call.durationSec,
  answered: call.answered,
  outcome: call.outcome,
  note: call.note,
});

export const toVisitDto = ({ visit, userName }: VisitView, storage: StoragePort): VisitDto => ({
  id: visit.id,
  leadId: visit.leadId,
  user: { id: visit.userId, name: userName },
  at: visit.at.toISOString(),
  latitude: visit.latitude,
  longitude: visit.longitude,
  note: visit.note,
  photoUrl: visit.photoUrl,
  media: visit.media.map((m) => {
    const urls =
      m.kind === 'VIDEO' ? storage.videoUrls(m.publicId) : storage.imageUrls(m.publicId);
    return {
      kind: m.kind,
      publicId: m.publicId,
      url: urls.url,
      thumbUrl: urls.thumbUrl,
      width: m.width,
      height: m.height,
      durationSec: m.durationSec,
    };
  }),
});

export const toActivityDto = ({ activity, byName }: ActivityView): LeadActivityDto => ({
  id: activity.id,
  type: activity.type,
  at: activity.at.toISOString(),
  by: activity.byUserId ? { id: activity.byUserId, name: byName ?? 'Unknown' } : null,
  data: activity.data,
});

export const toCallStatDto = ({ stat, userName }: CallStatView): CallStatDto => ({
  user: { id: stat.userId, name: userName },
  calls: stat.calls,
  answered: stat.answered,
  talkSeconds: stat.talkSeconds,
});

export const toLeadDesignDto = (
  { design, userName }: LeadDesignView,
  storage: StoragePort,
): LeadDesignDto => ({
  id: design.id,
  leadId: design.leadId,
  user: { id: design.userId, name: userName },
  at: design.at.toISOString(),
  note: design.note,
  media: design.media.map((m) => {
    if (m.kind === 'VIDEO') {
      const urls = storage.videoUrls(m.publicId);
      return {
        kind: m.kind,
        publicId: m.publicId,
        fileName: m.fileName,
        url: urls.url,
        thumbUrl: urls.thumbUrl,
        downloadUrl: urls.url,
        width: m.width,
        height: m.height,
        durationSec: m.durationSec,
      };
    }
    const urls = storage.fileUrls(m.publicId, m.kind === 'IMAGE' ? 'IMAGE' : 'FILE', {
      resourceType: m.resourceType === 'raw' ? 'raw' : m.resourceType === 'image' ? 'image' : null,
      format: m.format,
    });
    return {
      kind: m.kind,
      publicId: m.publicId,
      fileName: m.fileName,
      url: urls.url,
      thumbUrl: urls.thumbUrl,
      downloadUrl: urls.downloadUrl,
      width: m.width,
      height: m.height,
      durationSec: m.durationSec,
    };
  }),
});
