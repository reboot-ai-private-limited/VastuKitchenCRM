'use client';

import {
  CalendarClock,
  FileText,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkspaceSection = 'feed' | 'todos' | 'complaints' | 'docs' | 'announcements' | 'meetings';

const ITEMS: Array<{ id: WorkspaceSection; label: string; icon: LucideIcon; soon?: boolean }> = [
  { id: 'feed', label: 'Chat', icon: MessagesSquare },
  { id: 'todos', label: 'To-do', icon: ListChecks },
  { id: 'complaints', label: 'Complaints', icon: LifeBuoy },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, soon: true },
  { id: 'meetings', label: 'Schedule', icon: CalendarClock, soon: true },
];

/**
 * The project's own navigation, like WhatsApp Web's left column: a vertical list from `md`, a
 * scrolling row of pills on phones. Which sections exist depends on the viewer (`sections`).
 */
export function WorkspaceNav({
  sections,
  value,
  onChange,
}: {
  sections: readonly WorkspaceSection[];
  value: WorkspaceSection;
  onChange: (s: WorkspaceSection) => void;
}) {
  return (
    <nav
      aria-label="Project sections"
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
    >
      {ITEMS.filter((i) => sections.includes(i.id)).map((i) => {
        const active = i.id === value;
        return (
          <button
            key={i.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(i.id)}
            className={cn(
              'focus-visible:ring-ring flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 md:py-2.5',
              active
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <i.icon className="size-4" aria-hidden />
            {i.label}
            {i.soon && (
              <span className="soon-shimmer bg-primary-soft text-primary ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                Soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
