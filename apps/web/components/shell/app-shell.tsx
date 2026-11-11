'use client';

import { Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { UserDto } from '@vastu/contracts';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BottomTabs } from './bottom-tabs';
import { NotificationBell } from './notification-bell';
import { SidebarNav } from './sidebar-nav';
import { UserMenu } from './user-menu';

/** Staff shell: sticky top bar, fixed sidebar from `lg`, drawer on tablets, bottom tabs on phones. */
export function AppShell({ user, children }: { user: UserDto; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur lg:px-4">
        <Button variant="ghost" size="icon" className="hidden md:inline-flex lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
          <Menu />
        </Button>
        <Logo />
        <div className="flex-1" />
        <NotificationBell />
        <UserMenu user={user} />
      </header>

      <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
        <aside className="bg-sidebar sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-r lg:block">
          <SidebarNav role={user.role} />
        </aside>
        <main id="main" className="min-w-0 p-4 pb-24 md:pb-6 lg:p-6">
          {children}
        </main>
      </div>

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>
              <Logo />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav role={user.role} onNavigate={() => setDrawer(false)} />
        </SheetContent>
      </Sheet>
      <BottomTabs role={user.role} />
    </div>
  );
}
