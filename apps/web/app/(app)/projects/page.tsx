import { Suspense } from 'react';
import { ProjectsView } from '@/components/projects/projects-view';

/** Every role sees this list; the API narrows it to the projects each person may open. */
export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsView />
    </Suspense>
  );
}
