'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ComplaintDetail } from '@/components/complaints/complaint-detail';
import { complaintInProject } from '@/components/complaints/complaints-view';
import { PageBody } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useComplaint } from '@/lib/api/complaints';
import { useAuth } from '@/lib/auth';

/**
 * A complaint opens inside its project (chat, to-dos and docs around it), with a way back to the
 * Complaints page. A technician who is only assigned may not open the project, so they keep the
 * standalone page; so does anyone when the complaint cannot be loaded (it shows its own error).
 */
export default function ComplaintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const q = useComplaint(id);
  const standalone = user?.role === 'TECHNICIAN' || q.isError;

  useEffect(() => {
    if (q.data && !standalone) router.replace(complaintInProject(q.data));
  }, [q.data, standalone, router]);

  if (standalone) return <ComplaintDetail id={id} />;
  return (
    <PageBody>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-80 w-full" />
    </PageBody>
  );
}
