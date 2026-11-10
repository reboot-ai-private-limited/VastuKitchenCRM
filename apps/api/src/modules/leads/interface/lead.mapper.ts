import type { CallDto, CallStatDto, LeadActivityDto, LeadDto, VisitDto } from '@vastu/contracts';
import type { CallView, CallStatView } from '../application/usecases/calls.usecase.js';
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

export const toVisitDto = ({ visit, userName }: VisitView): VisitDto => ({
  id: visit.id,
  leadId: visit.leadId,
  user: { id: visit.userId, name: userName },
  at: visit.at.toISOString(),
  latitude: visit.latitude,
  longitude: visit.longitude,
  note: visit.note,
  photoUrl: visit.photoUrl,
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
