'use client';

import { FolderKanban, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { UserDto } from '@vastu/contracts';
import { Logo } from '@/components/common/logo';
import { isActive } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

const TABS = [
  { href: '/projects', label: 'Project', icon: FolderKanban },
  { href: '/complaints', label: 'Complaints', icon: LifeBuoy },
];

/** Customers: no sidebar. Top bar, a centred column, and a bottom bar (docs/05-design/screens.md §12). */
export function CustomerShell({ user, children }: { user: UserDto; children: ReactNode }) {
  const pathname = usePathname();
  const workspace = /^\/projects\/[^/]+\/?$/.test(pathname);
  return (
    <div className="min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur">
        <Logo />
        <div className="flex-1" />
        <NotificationBell />
        <UserMenu user={user} />
      </header>
      <main
        id="main"
        className={
          workspace
            ? 'h-[calc(100dvh-3.5rem)] overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))]'
            : 'mx-auto max-w-3xl p-4 pb-24'
        }
      >
        {children}
      </main>
      <nav
        aria-label="Main"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {TABS.map((t) => {
          const active = isActive(t.href, pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]',
                active ? 'text-primary font-medium' : 'text-muted-foreground',
              )}
            >
              <t.icon className="size-5" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
