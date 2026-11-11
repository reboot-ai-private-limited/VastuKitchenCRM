'use client';

import type { TodoDto } from '@vastu/contracts';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { dueChip } from '@/lib/todos';
import { cn } from '@/lib/utils';

const TONE = {
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  neutral: 'bg-neutral-soft text-neutral',
} as const;

export function DueBadge({ todo }: { todo: Pick<TodoDto, 'dueOn' | 'completed' | 'isOverdue'> }) {
  const chip = dueChip(todo);
  if (!chip) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[chip.tone],
      )}
    >
      {chip.label}
    </span>
  );
}

/** Up to three avatars, then "+N". The names are in the accessible label. */
export function AssigneeStack({ people }: { people: Array<{ id: string; name: string }> }) {
  if (people.length === 0) return null;
  const shown = people.slice(0, 3);
  return (
    <span
      className="flex -space-x-1.5"
      role="img"
      aria-label={`Assigned to ${people.map((p) => p.name).join(', ')}`}
    >
      {shown.map((p) => (
        <Avatar key={p.id} className="ring-card size-6 ring-2">
          <AvatarFallback className="text-[9px]">{initials(p.name)}</AvatarFallback>
        </Avatar>
      ))}
      {people.length > shown.length && (
        <span className="bg-muted text-muted-foreground ring-card grid size-6 place-items-center rounded-full text-[9px] font-medium ring-2">
          +{people.length - shown.length}
        </span>
      )}
    </span>
  );
}

/** The check box. Controlled by the data: the optimistic update flips it before the API answers. */
export function TodoCheck({
  todo,
  onToggle,
  disabled,
}: {
  todo: Pick<TodoDto, 'title' | 'completed'>;
  onToggle: (done: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Checkbox
      checked={todo.completed !== null}
      disabled={disabled}
      aria-label={`${todo.completed ? 'Reopen' : 'Complete'}: ${todo.title}`}
      onCheckedChange={(c) => onToggle(c === true)}
    />
  );
}
