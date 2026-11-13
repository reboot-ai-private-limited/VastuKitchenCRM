import type {
  ComplaintDto,
  ComplaintEventDto,
  ImageDto,
  PostDto,
  ProjectActivityDto,
  TimelineItemDto,
} from '@vastu/contracts';
import { addDays, businessDate, formatWeekdayDate } from '@/lib/format';

export type StreamItem =
  | { key: string; at: string; type: 'post'; post: PostDto }
  | { key: string; at: string; type: 'activity'; activity: ProjectActivityDto }
  | { key: string; at: string; type: 'complaint'; complaint: ComplaintDto }
  | {
      key: string;
      at: string;
      type: 'update';
      complaint: ComplaintDto;
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

function dayLabel(at: string, today: string, yesterday: string): string {
  const d = businessDate(at);
  if (d === today) return 'Today';
  if (d === yesterday) return 'Yesterday';
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
    if (i.kind === 'POST') out.push({ key: `p:${i.post.id}`, at: i.at, type: 'post', post: i.post });
    else if (!i.activity.type.startsWith('COMPLAINT_'))
      out.push({ key: `a:${i.activity.id}`, at: i.at, type: 'activity', activity: i.activity });
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
        text: `${m.author.name}: ${m.text ?? 'Sent a photo'}`,
        photos: m.images,
      });
    }
  }

  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  // Date separators: in an inverted list the separator belongs after the oldest item of that day.
  const today = businessDate(now);
  const yesterday = addDays(today, -1);
  const withDays: StreamItem[] = [];
  out.forEach((item, idx) => {
    withDays.push(item);
    const next = out[idx + 1];
    if (!next || businessDate(next.at) !== businessDate(item.at)) {
      withDays.push({
        key: `d:${businessDate(item.at)}`,
        at: item.at,
        type: 'day',
        label: dayLabel(item.at, today, yesterday),
      });
    }
  });
  return withDays;
}
