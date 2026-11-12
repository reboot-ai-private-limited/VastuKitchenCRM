'use client';

/* eslint-disable @next/next/no-img-element -- remote template pictures */
import type { ProposalTemplateSummaryDto } from '@vastu/contracts';
import { Copy, Lock, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import {
  useDeleteProposalTemplate,
  useDuplicateProposalTemplate,
  useProposalTemplates,
} from '@/lib/api/proposal-templates';
import { DEFAULT_PROPOSAL_TEMPLATE_KEY } from '@vastu/contracts';

function Card({
  t,
  onCopy,
  onDelete,
  busy,
}: {
  t: ProposalTemplateSummaryDto;
  onCopy: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="bg-card shadow-card flex flex-col overflow-hidden rounded-xl border">
      <Link href={`/proposals/templates/${t.key}`} className="bg-muted relative block h-44">
        {t.coverImage ? (
          <img src={t.coverImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: t.primary }} />
        )}
        <span className="absolute bottom-0 left-0 h-1.5 w-full" style={{ background: t.primary }} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold">{t.name}</h2>
          {t.builtin && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Lock className="size-3" /> Built-in
            </span>
          )}
        </div>
        <p className="text-muted-foreground flex-1 text-sm">{t.description}</p>
        <p className="text-muted-foreground text-xs">{t.pageCount} pages</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={`/proposals/templates/${t.key}`}>
              <Pencil /> {t.builtin ? 'View' : 'Edit'}
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={onCopy} disabled={busy}>
            <Copy /> Copy
          </Button>
          {!t.builtin && (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={onDelete}
              disabled={busy}
            >
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TemplateGallery() {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useProposalTemplates();
  const duplicate = useDuplicateProposalTemplate();
  const remove = useDeleteProposalTemplate();
  const [deleting, setDeleting] = useState<ProposalTemplateSummaryDto | null>(null);

  const copy = (key: string, edit = true) =>
    duplicate.mutate(
      { key },
      {
        onSuccess: (c) => {
          toast.success('Copied');
          if (edit) router.push(`/proposals/templates/${c.key}`);
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Could not copy the template.'),
      },
    );

  return (
    <PageBody>
      <PageHeader
        title="Proposal templates"
        description="How proposals look: cover, pages, thank-you. Built-in designs can be copied and changed."
        actions={
          <Button
            onClick={() => copy(DEFAULT_PROPOSAL_TEMPLATE_KEY)}
            disabled={duplicate.isPending}
          >
            New template
          </Button>
        }
      />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((t) => (
            <Card
              key={t.key}
              t={t}
              busy={duplicate.isPending || remove.isPending}
              onCopy={() => copy(t.key)}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              Proposals already made with it keep their look. You just can’t pick it for new ones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting.key, {
                  onSuccess: () => {
                    toast.success('Template deleted');
                    setDeleting(null);
                  },
                  onError: (e) =>
                    toast.error(e instanceof ApiError ? e.message : 'Could not delete.'),
                })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
