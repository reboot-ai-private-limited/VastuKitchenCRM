import { CircleCheck, ImageIcon, Inbox, MessageSquare, StickyNote, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { RecentFeedItemDto } from '@vastu/contracts';
import { EmptyState } from '@/components/common/empty-state';
import { relativeAge } from '@/lib/format';

const KIND: Record<RecentFeedItemDto['kind'], { icon: LucideIcon; verb: string }> = {
  POST: { icon: StickyNote, verb: 'posted on' },
  COMMENT: { icon: MessageSquare, verb: 'commented on' },
  APPROVAL: { icon: CircleCheck, verb: 'approved the design on' },
};

export function RecentBlock({ items }: { items: RecentFeedItemDto[] }) {
  if (items.length === 0)
    return <EmptyState icon={Inbox} title="No customer activity yet" description="Customer posts, comments and approvals appear here." />;
  return (
    <ul className="divide-y">
      {items.map((x) => {
        const { icon: Icon, verb } = KIND[x.kind];
        return (
          <li key={`${x.kind}-${x.postId}-${x.at}`}>
            <Link
              href={`/projects/${x.projectId}?post=${x.postId}`}
              className="hover:bg-primary-soft/50 focus-visible:ring-ring flex items-start gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block">
                  <span className="font-medium">{x.authorName}</span> {verb} <span className="font-medium">{x.projectName}</span>
                </span>
                {x.snippet && <span className="text-muted-foreground line-clamp-2 text-xs">“{x.snippet}”</span>}
              </span>
              {x.hasPhotos && <ImageIcon className="text-muted-foreground size-4 shrink-0" aria-label="Has photos" />}
              <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">{relativeAge(x.at)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
