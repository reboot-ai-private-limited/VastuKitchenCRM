'use client';

import { useParams } from 'next/navigation';
import { ProjectDetail } from '@/components/projects/project-detail';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectDetail id={id} />;
}
