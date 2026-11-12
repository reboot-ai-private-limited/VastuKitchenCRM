'use client';

import { findBuiltinTemplate } from '@vastu/contracts';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useProposalTemplate } from '@/lib/api/proposal-templates';
import { TemplateEditor } from './template-editor';

export function TemplateScreen({ templateKey }: { templateKey: string }) {
  const builtin = findBuiltinTemplate(templateKey);
  const q = useProposalTemplate(builtin ? null : templateKey);
  const template = builtin ?? q.data;
  if (template) return <TemplateEditor key={template.key} initial={template} builtin={!!builtin} />;
  if (q.error instanceof ApiError && q.error.status === 404) return <NotFoundView />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return <Skeleton className="h-96 w-full" />;
}
