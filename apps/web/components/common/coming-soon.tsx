import { Hammer } from 'lucide-react';
import { PageBody, PageHeader } from './page-header';
import { EmptyState } from './empty-state';

/** A route that is in the nav but not built yet (docs/05-design/implementation-guide.md, build order). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <PageBody>
      <PageHeader title={title} />
      <div className="bg-card shadow-card rounded-xl border">
        <EmptyState icon={Hammer} title="This screen is next in the build" description="The data is already available in the API; the screen follows the build order." />
      </div>
    </PageBody>
  );
}
