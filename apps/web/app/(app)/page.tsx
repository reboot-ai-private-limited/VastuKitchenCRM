'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { useAuth } from '@/lib/auth';
import { landingFor } from '@/lib/nav';

/** The dashboard is for Admin and HR; everyone else is sent to their own home page. */
export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = user?.role === 'ADMIN' || user?.role === 'HR';

  useEffect(() => {
    if (user && !allowed) router.replace(landingFor(user.role));
  }, [user, allowed, router]);

  if (!allowed) return null;
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
