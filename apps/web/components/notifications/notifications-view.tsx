'use client';

import {
  Bell,
  BellOff,
  FileText,
  FolderKanban,
  LifeBuoy,
  ListChecks,
  Paperclip,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NotificationDto } from '@vastu/contracts';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotificationsPage } from '@/lib/api/notifications-page';
import { useMarkAllRead, useMarkNotificationRead, useUnreadCount } from '@/lib/api/queries';
import { formatDate, formatTime, relativeAge } from '@/lib/format';
import { groupOf, refHref, type NotificationGroup } from '@/lib/notifications';
import { cn } from '@/lib/utils';

const ICON: Record<NotificationGroup, LucideIcon> = {
  lead: Users,
  proposal: FileText,
  project: FolderKanban,
  todo: ListChecks,
  file: Paperclip,
  complaint: LifeBuoy,
};

export function NotificationsView() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const q = useNotificationsPage(unreadOnly);
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const count = unread.data?.count ?? 0;

  function open(n: NotificationDto) {
    if (!n.readAt) markRead.mutate(n.id);
    router.push(refHref(n.ref));
  }

  return (
    <PageBody>
      <PageHeader
        title="Notifications"
        description={count > 0 ? `${count} unread` : 'You’re all caught up'}
        actions={
          <Button
            variant="outline"
            disabled={count === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {markAll.isPending ? 'Marking…' : 'Mark all read'}
          </Button>
        }
      />

      <div
        role="group"
        aria-label="Filter"
        className="bg-card shadow-card inline-flex rounded-lg border p-0.5"
      >
        {([false, true] as const).map((only) => (
          <Button
            key={String(only)}
            variant={unreadOnly === only ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={unreadOnly === only}
            onClick={() => setUnreadOnly(only)}
          >
            {only ? 'Unread' : 'All'}
          </Button>
        ))}
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={unreadOnly ? BellOff : Bell}
            title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            description={
              unreadOnly ? undefined : 'Alerts about your leads, projects and tasks show up here.'
            }
          />
        ) : (
          <>
            <ul>
              {items.map((n) => {
                const Icon = ICON[groupOf(n.type)];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn(
                        'hover:bg-primary-soft/50 focus-visible:bg-primary-soft/50 flex w-full gap-3 border-b px-4 py-3 text-left outline-none last:border-b-0',
                        !n.readAt && 'bg-primary-soft/40',
                      )}
                    >
                      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block', !n.readAt ? 'font-semibold' : 'font-medium')}>
                          {n.title}
                        </span>
                        <span className="text-muted-foreground block text-sm">{n.body}</span>
                        <time
                          dateTime={n.createdAt}
                          title={`${formatDate(n.createdAt)}, ${formatTime(n.createdAt)}`}
                          className="text-muted-foreground mt-0.5 block text-xs"
                        >
                          {relativeAge(n.createdAt)}
                        </time>
                      </span>
                      {!n.readAt && (
                        <span
                          aria-label="Unread"
                          className="bg-primary mt-1.5 size-2 shrink-0 rounded-full"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {q.hasNextPage && (
              <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5">
                <p className="text-muted-foreground tabular text-xs">
                  Showing {items.length} of {total}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={q.isFetchingNextPage}
                  onClick={() => q.fetchNextPage()}
                >
                  {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PageBody>
  );
}
