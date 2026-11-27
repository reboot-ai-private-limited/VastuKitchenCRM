import type {
  CommentDto,
  ComplaintDto,
  ComplaintEventDto,
  ImageDto,
  PostDto,
  ProjectActivityDto,
  TimelineItemDto,
} from '@vastu/contracts';
import { addDays, businessDate, formatWeekdayDate } from '@/lib/format';

export type FileBatchEntry = {
  activityId: string;
  fileId: string | null;
  name: string;
};

export type StreamItem =
  | { key: string; at: string; type: 'post'; post: PostDto }
  | { key: string; at: string; type: 'reply'; comment: CommentDto; parent: PostDto }
  | { key: string; at: string; type: 'activity'; activity: ProjectActivityDto }
  | {
      key: string;
      at: string;
      type: 'files';
      actorName: string;
      files: FileBatchEntry[];
    }
  | { key: string; at: string; type: 'complaint'; complaint: ComplaintDto }
  | {
      key: string;
      at: string;
      type: 'update';
      complaint: ComplaintDto;
      actorName: string;
      actorId?: string | null;
      updateKind: 'ASSIGNED' | 'RESOLVED' | 'REOPENED' | 'CLOSED' | 'COMMENT';
      text: string;
      photos: ImageDto[];
    }
  | { key: string; at: string; type: 'day'; label: string };

const first = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function activityText(a: ProjectActivityDto): string {
  const who = a.actor?.name ?? 'Someone';
  const subject = first(a.data['todoTitle']) ?? first(a.data['fileName']) ?? first(a.data['name']) ?? first(a.data['title']);
  const tail = subject ? `: ${subject}` : '';
  switch (a.type) {
    case 'TODO_CREATED':
      return `${who} added a to-do${tail}`;
    case 'TODO_ASSIGNED':
      return `${who} assigned a to-do${tail}`;
    case 'TODO_DUE_CHANGED':
      return `${who} changed a due date${tail}`;
    case 'TODO_COMPLETED':
      return `${who} completed${tail || ' a to-do'}`;
    case 'TODO_REOPENED':
      return `${who} reopened a to-do${tail}`;
    case 'FILE_ADDED':
      return `${who} added a file${tail}`;
    case 'FILE_SHARED':
      return `${who} shared a file${tail}`;
    case 'FILES_SAVED':
      return `${who} saved photos to Docs`;
    default:
      return `${who} updated the project`;
  }
}

/** Drops a leading actor name, for lines shown under that name already. */
export function withoutActor(text: string, actor: string): string {
  if (!text.startsWith(`${actor} `)) return text;
  const rest = text.slice(actor.length + 1);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function eventText(e: ComplaintEventDto): string {
  const who = e.actor?.name ?? 'Someone';
  switch (e.type) {
    case 'ASSIGNED':
      return `${who} assigned this complaint${e.assignee ? ` to ${e.assignee.name}` : ''}`;
    case 'RESOLVED':
      return `${who} resolved this complaint`;
    case 'REOPENED':
      return `${who} reopened this complaint${e.note ? `: ${e.note}` : ''}`;
    case 'CLOSED':
      return `${who} closed this complaint`;
    default:
      return `${who} raised a complaint`;
  }
}

export function dayLabel(at: string, now: Date = new Date()): string {
  const d = businessDate(at);
  const today = businessDate(now);
  if (d === today) return 'Today';
  if (d === addDays(today, -1)) return 'Yesterday';
  return formatWeekdayDate(d);
}

/**
 * Merges posts, team activity lines, complaint cards and complaint update rows into one newest-first list
 * (render it inverted). Older complaint items are withheld while older feed pages remain (rule 19).
 */
export function buildStream(
  feed: TimelineItemDto[],
  complaints: ComplaintDto[],
  hasOlderPages: boolean,
  now: Date = new Date(),
): StreamItem[] {
  const out: StreamItem[] = [];
  for (const i of feed) {
    if (i.kind === 'POST') {
      out.push({ key: `p:${i.post.id}`, at: i.at, type: 'post', post: i.post });
    } else if (!i.activity.type.startsWith('COMPLAINT_')) {
      out.push({ key: `a:${i.activity.id}`, at: i.at, type: 'activity', activity: i.activity });
    }
  }

  const cutoff = hasOlderPages ? (feed[feed.length - 1]?.at ?? '9999') : '';
  for (const c of complaints) {
    const push = (item: StreamItem) => {
      if (item.at >= cutoff) out.push(item);
    };
    push({ key: `c:${c.id}`, at: c.createdAt, type: 'complaint', complaint: c });
    const lastResolved = [...c.history].reverse().find((e) => e.type === 'RESOLVED');
    c.history.forEach((e, idx) => {
      if (e.type === 'RAISED') return;
      push({
        key: `cu:${c.id}:${idx}`,
        at: e.at,
        type: 'update',
        complaint: c,
        actorName: e.actor?.name ?? 'Someone',
        actorId: e.actor?.id ?? null,
        updateKind: e.type === 'ASSIGNED' || e.type === 'RESOLVED' || e.type === 'REOPENED' || e.type === 'CLOSED' ? e.type : 'RESOLVED',
        text: eventText(e),
        photos: e === lastResolved ? c.resolutionImages : [],
      });
    });
    for (const m of c.comments) {
      push({
        key: `cm:${c.id}:${m.id}`,
        at: m.createdAt,
        type: 'update',
        complaint: c,
        actorName: m.author.name,
        actorId: m.author.id,
        updateKind: 'COMMENT',
        text: m.text ?? 'Sent a photo',
        photos: m.images,
      });
    }
  }

  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  // Collapse consecutive FILE_ADDED activities by the same actor on the same day into one file-list card.
  // FILE_SHARED stays its own separate activity event.
  const grouped: StreamItem[] = [];
  let i = 0;
  while (i < out.length) {
    const cur = out[i]!;
    if (cur.type === 'activity' && cur.activity.type === 'FILE_ADDED') {
      const actorKey = cur.activity.actor?.id ?? cur.activity.actor?.name ?? 'someone';
      const actorName = cur.activity.actor?.name ?? 'Someone';
      const day = businessDate(cur.at);
      const batch: ProjectActivityDto[] = [cur.activity];
      let j = i + 1;
      while (j < out.length) {
        const next = out[j]!;
        if (
          next.type === 'activity' &&
          next.activity.type === 'FILE_ADDED' &&
          (next.activity.actor?.id ?? next.activity.actor?.name ?? 'someone') === actorKey &&
          businessDate(next.at) === day
        ) {
          batch.push(next.activity);
          j++;
        } else {
          break;
        }
      }
      // Show oldest-first inside the card so the list reads naturally top-to-bottom.
      const files: FileBatchEntry[] = [...batch].reverse().map((a) => ({
        activityId: a.id,
        fileId: first(a.data['fileId']),
        name: first(a.data['fileName']) ?? first(a.data['name']) ?? first(a.data['title']) ?? 'Document',
      }));
      grouped.push({
        key: `fb:${batch[0]!.id}`,
        at: cur.at,
        type: 'files',
        actorName,
        files,
      });
      i = j;
    } else {
      grouped.push(cur);
      i++;
    }
  }

  // Date separators: in an inverted list the separator belongs after the oldest item of that day.
  const withDays: StreamItem[] = [];
  grouped.forEach((item, idx) => {
    withDays.push(item);
    const next = grouped[idx + 1];
    if (!next || businessDate(next.at) !== businessDate(item.at)) {
      withDays.push({
        key: `d:${businessDate(item.at)}`,
        at: item.at,
        type: 'day',
        label: dayLabel(item.at, now),
      });
    }
  });
  return withDays;
}
