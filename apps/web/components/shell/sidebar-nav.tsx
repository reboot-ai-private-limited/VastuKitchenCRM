'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RoleName } from '@vastu/contracts';
import { NAV, isActive, navFor, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';

const GROUPS: NavItem['group'][] = ['Work', 'People', 'Admin'];

export function SidebarNav({ role, onNavigate }: { role: RoleName; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = navFor(role);
  return (
    <nav aria-label="Main" className="space-y-5 p-3">
      {GROUPS.map((group) => {
        const inGroup = items.filter((i) => i.group === group);
        if (inGroup.length === 0) return null;
        return (
          <div key={group} className="space-y-1">
            <p className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">{group}</p>
            {inGroup.map((item) => {
              const active = isActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-10 items-center gap-3 rounded-md px-3 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-muted',
                  )}
                >
                  {active && <span aria-hidden className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-full" />}
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export { NAV };
