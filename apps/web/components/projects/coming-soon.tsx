import { CalendarClock, Megaphone, Users } from 'lucide-react';

type Kind = 'announcements' | 'meetings';

const COPY: Record<Kind, { title: string; promise: string; mockTitle: string; mockMeta: string }> = {
  announcements: {
    title: 'Announcements',
    promise:
      'Post one clear notice to everyone on this project: site closures, delivery dates, changes of plan.',
    mockTitle: 'Site closed Sunday for tile work',
    mockMeta: 'Sneha · pinned for the team and the customer',
  },
  meetings: {
    title: 'Schedule a meeting',
    promise:
      'Set a site visit or a design review, invite the team and the customer, and get reminded before it starts.',
    mockTitle: 'Site visit · Fri, 11:00',
    mockMeta: 'Tarun, Sneha and the customer',
  },
};

/**
 * A placeholder for a project section that is on its way. Pure CSS motion (see `.soon-*` in
 * globals.css) that stops under "reduce motion"; no data and no buttons that do nothing.
 */
export function ComingSoon({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  const Icon = kind === 'announcements' ? Megaphone : CalendarClock;
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="relative grid size-28 place-items-center" aria-hidden>
        <span className="soon-glow bg-primary/25 absolute inset-0 rounded-full blur-2xl" />
        {kind === 'announcements' && (
          <>
            <span className="soon-ring border-primary/40 absolute inset-2 rounded-full border-2" />
            <span
              className="soon-ring border-primary/40 absolute inset-2 rounded-full border-2"
              style={{ animationDelay: '1.1s' }}
            />
          </>
        )}
        <span className="soon-float bg-primary text-primary-foreground relative grid size-16 place-items-center rounded-2xl shadow-lg">
          <Icon className="size-8" />
        </span>
      </div>

      <div className="max-w-sm space-y-2">
        <span className="soon-shimmer bg-primary-soft text-primary inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase">
          Coming soon
        </span>
        <h2 className="text-xl font-semibold">{c.title}</h2>
        <p className="text-muted-foreground text-sm">{c.promise}</p>
      </div>

      <div
        className="soon-card bg-card w-full max-w-sm rounded-xl border p-3 text-left shadow-sm"
        aria-hidden
      >
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary grid size-9 shrink-0 place-items-center rounded-lg">
            {kind === 'meetings' ? <Users className="size-4" /> : <Megaphone className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{c.mockTitle}</p>
            <p className="text-muted-foreground truncate text-xs">{c.mockMeta}</p>
          </div>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">A preview of what it will look like.</p>
    </div>
  );
}
