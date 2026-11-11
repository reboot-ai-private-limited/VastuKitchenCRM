'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Logo } from '@/components/common/logo';
import { AppShell } from '@/components/shell/app-shell';
import { CustomerShell } from '@/components/shell/customer-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';

/** Everything behind sign-in. The server only redirects on a hint; here the real session decides. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace(pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="min-h-dvh" role="status" aria-label="Loading">
        <div className="flex h-14 items-center border-b px-4">
          <Logo />
        </div>
        <div className="space-y-4 p-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }
  return user.role === 'CUSTOMER' ? <CustomerShell user={user}>{children}</CustomerShell> : <AppShell user={user}>{children}</AppShell>;
}
