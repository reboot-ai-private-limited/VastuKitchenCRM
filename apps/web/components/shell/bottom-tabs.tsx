'use client';

import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { RoleName } from '@vastu/contracts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { isActive, navFor } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { SidebarNav } from './sidebar-nav';

/** Phone navigation (< md): at most 5 slots; the rest live under "More". */
export function BottomTabs({ role }: { role: RoleName }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const items = navFor(role);
  const needsMore = items.length > 5;
  const tabs = needsMore ? items.slice(0, 4) : items;

  const slot =
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';
  return (
    <>
      <nav
        aria-label="Main"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {tabs.map((item) => {
          const active = isActive(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(slot, active ? 'text-primary font-medium' : 'text-muted-foreground')}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
        {needsMore && (
          <button
            type="button"
            onClick={() => setMore(true)}
            className={cn(slot, 'text-muted-foreground')}
          >
            <Ellipsis className="size-5" aria-hidden />
            More
          </button>
        )}
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <SidebarNav role={role} onNavigate={() => setMore(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
