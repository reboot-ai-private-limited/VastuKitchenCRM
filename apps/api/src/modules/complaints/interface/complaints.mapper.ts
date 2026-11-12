import type { ComplaintDto } from '@vastu/contracts';
import type { ComplaintView } from '../application/services/complaintViews.js';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const toComplaintDto = (v: ComplaintView): ComplaintDto => {
  const c = v.complaint;
  return {
    id: c.id,
    projectId: c.projectId,
    projectName: v.projectName,
    customer: v.customer,
    description: c.description,
    images: v.images,
    status: c.status,
    raisedBy: v.raisedBy,
    assignedTo: v.assignedTo,
    resolutionNote: c.resolutionNote,
    resolutionImages: v.resolutionImages,
    createdAt: c.createdAt.toISOString(),
    assignedAt: iso(c.assignedAt),
    resolvedAt: iso(c.resolvedAt),
    closedAt: iso(c.closedAt),
    reopenCount: c.reopenCount,
    history: v.history.map((h) => ({
      type: h.type,
      at: h.at.toISOString(),
      actor: h.actor,
      note: h.note,
      assignee: h.assignee,
    })),
    comments: v.comments.map((m) => ({
      id: m.id,
      author: m.author,
      text: m.text,
      images: m.images,
      createdAt: m.createdAt.toISOString(),
      canDelete: m.canDelete,
    })),
    can: v.can,
  };
};
