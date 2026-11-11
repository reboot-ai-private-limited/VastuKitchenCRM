'use client';

import {
  Bell,
  BellOff,
  CalendarClock,
  FileText,
  FolderKanban,
  LifeBuoy,
  ListChecks,
  Paperclip,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { NotificationDto } from '@vastu/contracts';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/api/queries';
import { relativeAge } from '@/lib/format';
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

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotifications(10, open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const count = unread.data?.count ?? 0;

  function openItem(n: NotificationDto) {
    setOpen(false);
    if (!n.readAt) markRead.mutate(n.id);
    router.push(refHref(n.ref));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
          className="relative"
        >
          <Bell />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground tabular absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full px-1 text-[10px] leading-4.5 font-semibold">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="font-semibold">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={count === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {list.isPending ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : list.data.items.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8">
              <BellOff className="size-5" aria-hidden />
              <p>You’re all caught up.</p>
            </div>
          ) : (
            <ul>
              {list.data.items.map((n) => {
                const Icon = ICON[groupOf(n.type)] ?? CalendarClock;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        'hover:bg-muted focus-visible:bg-muted flex w-full gap-3 border-b px-3 py-2.5 text-left last:border-b-0 focus-visible:outline-none',
                        !n.readAt && 'bg-primary-soft/40',
                      )}
                    >
                      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{n.title}</span>
                        <span className="text-muted-foreground line-clamp-2 text-xs">{n.body}</span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {relativeAge(n.createdAt)}
                        </span>
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
          )}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-primary text-xs font-medium hover:underline"
          >
            See all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
