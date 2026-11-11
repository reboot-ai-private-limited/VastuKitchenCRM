'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { ProjectDetail } from '@/components/projects/project-detail';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <ProjectDetail id={id} />
    </Suspense>
  );
}
