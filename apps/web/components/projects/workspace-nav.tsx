'use client';

import { FileText, LifeBuoy, ListChecks, MessagesSquare, Activity, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkspaceSection = 'feed' | 'todos' | 'complaints' | 'docs' | 'activity';

const ITEMS: Array<{ id: WorkspaceSection; label: string; icon: LucideIcon }> = [
  { id: 'feed', label: 'Chat', icon: MessagesSquare },
  { id: 'todos', label: 'To-do', icon: ListChecks },
  { id: 'complaints', label: 'Complaints', icon: LifeBuoy },
  { id: 'docs', label: 'Docs', icon: FileText },
  { id: 'activity', label: 'Activity', icon: Activity },
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
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:sticky md:top-20 md:flex-col md:overflow-visible md:px-0 md:pb-0"
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
          </button>
        );
      })}
    </nav>
  );
}
