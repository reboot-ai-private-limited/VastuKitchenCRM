import { Badge } from '@/components/ui/badge';
import { usePendingOutbox, type OutboxItem } from './outbox';

/** "Pending sync" chip. Renders nothing when nothing is waiting. */
export function PendingSyncBadge({ filter }: { filter?: (i: OutboxItem) => boolean }) {
  const pending = usePendingOutbox(filter);
  if (pending.length === 0) return null;
  const label = pending.length === 1 ? 'Pending sync' : `Pending sync (${pending.length})`;
  return <Badge label={label} t="warning" />;
}
