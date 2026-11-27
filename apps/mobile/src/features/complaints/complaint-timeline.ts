import type { ComplaintCommentDto, ComplaintDto, ComplaintEventDto } from '@vastu/contracts';

export type ComplaintTimelineItem =
  | { key: string; at: string; type: 'comment'; comment: ComplaintCommentDto }
  | { key: string; at: string; type: 'event'; event: ComplaintEventDto; isResolution: boolean };

/**
 * Everything after the complaint was raised (history and messages) as one list, oldest first.
 * The event that carries the current resolution note and photos is marked `isResolution`.
 */
export function complaintTimeline(c: ComplaintDto): ComplaintTimelineItem[] {
  const events = c.history.filter((e) => e.type !== 'RAISED');
  const lastResolved = [...events].reverse().find((e) => e.type === 'RESOLVED');
  // A resolution with no history line must still be shown.
  const orphan: ComplaintEventDto | null =
    !lastResolved && (c.resolutionNote || c.resolutionImages.length > 0)
      ? {
          type: 'RESOLVED',
          at: c.resolvedAt ?? c.createdAt,
          actor: null,
          note: c.resolutionNote,
          assignee: null,
        }
      : null;

  const items: ComplaintTimelineItem[] = [
    ...(orphan ? [...events, orphan] : events).map((event, i) => ({
      key: `e:${i}`,
      at: event.at,
      type: 'event' as const,
      event,
      isResolution: event === (lastResolved ?? orphan),
    })),
    ...c.comments.map((comment) => ({
      key: `m:${comment.id}`,
      at: comment.createdAt,
      type: 'comment' as const,
      comment,
    })),
  ];
  return items.sort((a, b) => a.at.localeCompare(b.at));
}
