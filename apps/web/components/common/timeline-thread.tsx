import {
  CircleDot,
  Eye,
  FileText,
  FlagTriangleRight,
  FolderCheck,
  FolderPlus,
  MapPin,
  Phone,
  PhoneMissed,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';
import type { LeadActivityDto } from '@vastu/contracts';
import { describeActivity } from '@/lib/lead-activity';
import { businessDate, formatDate, formatTime, relativeAge } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'danger';

const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground ring-border',
  primary: 'bg-primary-soft text-primary ring-primary/25',
  success: 'bg-success-soft text-success ring-success/30',
  danger: 'bg-danger-soft text-danger ring-danger/30',
};

function look(a: LeadActivityDto): { icon: LucideIcon; tone: Tone } {
  switch (a.type) {
    case 'CREATED':
      return { icon: UserPlus, tone: 'primary' };
    case 'ASSIGNED':
      return { icon: UserRoundCheck, tone: 'neutral' };
    case 'STATUS_CHANGED':
      return {
        icon: FlagTriangleRight,
        tone: a.data['to'] === 'WON' ? 'success' : a.data['to'] === 'LOST' ? 'danger' : 'primary',
      };
    case 'CALL':
      return a.data['answered'] === true
        ? { icon: Phone, tone: 'success' }
        : { icon: PhoneMissed, tone: 'neutral' };
    case 'VISIT':
      return { icon: MapPin, tone: 'primary' };
    case 'PROPOSAL_SENT':
      return { icon: FileText, tone: 'primary' };
    case 'PROPOSAL_SEEN':
      return { icon: Eye, tone: 'neutral' };
    case 'PROJECT_CREATED':
      return { icon: FolderPlus, tone: 'success' };
    case 'PROJECT_CLOSED':
      return { icon: FolderCheck, tone: 'neutral' };
    default:
      return { icon: CircleDot, tone: 'neutral' };
  }
}

const dayHeading = (at: string): string => {
  const day = businessDate(at);
  const today = businessDate();
  if (day === today) return 'Today';
  if (day === businessDate(new Date(Date.now() - 86_400_000))) return 'Yesterday';
  return formatDate(at);
};

/**
 * A lead's history as a thread: a vertical line runs through one icon dot per event, newest first,
 * grouped under day headings. Used on both the lead and the customer page.
 */
export function TimelineThread({ items }: { items: LeadActivityDto[] }) {
  const groups: Array<{ heading: string; items: LeadActivityDto[] }> = [];
  for (const a of items) {
    const heading = dayHeading(a.at);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(a);
    else groups.push({ heading, items: [a] });
  }
  return (
    <div className="space-y-5 p-4 sm:p-5">
      {groups.map((g) => (
        <section key={g.heading + g.items[0]!.id} aria-label={g.heading}>
          <h3 className="text-muted-foreground mb-3 text-[11px] font-semibold tracking-wider uppercase">
            {g.heading}
          </h3>
          <ol>
            {g.items.map((a, i) => {
              const { title, detail } = describeActivity(a);
              const { icon: Icon, tone } = look(a);
              const last = i === g.items.length - 1;
              return (
                <li key={a.id} className="relative flex gap-3.5 pb-5 last:pb-0">
                  {/* the thread: a line from this dot down to the next one */}
                  {!last && (
                    <span
                      aria-hidden
                      className="bg-border absolute top-8 bottom-0 left-4 w-px -translate-x-1/2"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      'relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-1',
                      TONE[tone],
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-medium">{title}</p>
                      <time
                        dateTime={a.at}
                        className="text-muted-foreground text-xs"
                        title={`${formatDate(a.at)}, ${formatTime(a.at)}`}
                      >
                        {formatTime(a.at)} · {relativeAge(a.at)}
                      </time>
                    </div>
                    {detail && <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
