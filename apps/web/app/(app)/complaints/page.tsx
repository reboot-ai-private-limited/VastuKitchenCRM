import { Suspense } from 'react';
import { ComplaintsView } from '@/components/complaints/complaints-view';

/** Every role sees this page; the API narrows it to the complaints each person may open. */
export default function ComplaintsPage() {
  return (
    <Suspense>
      <ComplaintsView />
    </Suspense>
  );
}
