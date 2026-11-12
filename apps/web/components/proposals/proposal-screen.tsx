'use client';

import type { ProposalDto } from '@vastu/contracts';
import { ArrowLeft, Copy, ExternalLink, Eye, Files, MessageCircle, Snowflake } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { NotFoundView } from '@/components/common/not-found-view';
import { PageBody } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useLead } from '@/lib/api/leads';
import { formatPhone } from '@/lib/leads';
import { useDuplicateProposal, useProposal } from '@/lib/api/proposals';
import { formatDate, formatTime, relativeAge } from '@/lib/format';
import { ProposalBuilder } from './proposal-builder';
import { TemplateDocument } from './render/template-document';
import { SendFlow, copyLink } from './send-flow';

const Loading = () => (
  <PageBody>
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-96 w-full" />
  </PageBody>
);

/** `/proposals/new?leadId=…`: the customer comes from the lead. */
export function NewProposalScreen({ leadId }: { leadId: string | null }) {
  const lead = useLead(leadId ?? '', !!leadId);
  if (!leadId) return <NotFoundView />;
  if (lead.isPending) return <Loading />;
  if (lead.isError)
    return lead.error instanceof ApiError && lead.error.isNotFound ? (
      <NotFoundView />
    ) : (
      <ErrorState error={lead.error} onRetry={() => lead.refetch()} />
    );
  return <ProposalBuilder proposal={null} lead={lead.data} onSend={() => undefined} />;
}

/** `/proposals/[id]`: a draft opens the builder; a sent proposal opens the frozen view. */
export function ProposalScreen({ id }: { id: string }) {
  const q = useProposal(id);
  const [sending, setSending] = useState(false);
  if (q.isPending) return <Loading />;
  if (q.isError)
    return q.error instanceof ApiError && q.error.isNotFound ? (
      <NotFoundView />
    ) : (
      <ErrorState error={q.error} onRetry={() => q.refetch()} />
    );
  const p = q.data;
  return (
    <>
      {p.status === 'DRAFT' ? (
        // Keyed by id so opening another draft never reuses this one's form state.
        <ProposalBuilder key={p.id} proposal={p} lead={null} onSend={() => setSending(true)} />
      ) : (
        <SentView proposal={p} onShare={() => setSending(true)} />
      )}
      {/* Lives here, not in the builder: sending turns the draft into the sent view, and the dialog must survive that. */}
      <SendFlow proposal={p} open={sending} onClose={() => setSending(false)} />
    </>
  );
}

function SentView({ proposal: p, onShare }: { proposal: ProposalDto; onShare: () => void }) {
  const router = useRouter();
  const duplicate = useDuplicateProposal();
  const lead = p.leadId;
  return (
    <PageBody>
      <div>
        <Link
          href="/proposals"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Proposals
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="tabular text-xl font-semibold tracking-tight">{p.number}</h1>
            <p className="text-muted-foreground text-sm">
              For{' '}
              <Link href={`/leads/${lead}`} className="underline">
                {p.customer.name}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onShare}>
              <MessageCircle /> Share on WhatsApp
            </Button>
            {p.publicUrl && (
              <>
                <Button variant="outline" onClick={() => void copyLink(p.publicUrl!)}>
                  <Copy /> Copy link
                </Button>
                <Button variant="outline" asChild>
                  <a href={p.publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> Customer view
                  </a>
                </Button>
              </>
            )}
            <Button
              disabled={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(p.id, {
                  onSuccess: (d) => {
                    toast.success(`New draft ${d.number} created`);
                    router.push(`/proposals/${d.id}`);
                  },
                  onError: (e) =>
                    toast.error(e instanceof ApiError ? e.message : 'Couldn’t duplicate.'),
                })
              }
            >
              <Files /> {duplicate.isPending ? 'Duplicating…' : 'Duplicate to edit'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-info-soft text-info flex items-center gap-2 rounded-lg p-3 text-sm">
        <Snowflake className="size-4 shrink-0" aria-hidden />
        <span>
          {p.sentAt ? `Sent on ${formatDate(p.sentAt)}` : 'Sent'} · Frozen: the customer sees
          exactly this. To change prices, duplicate it into a new draft.
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <TemplateDocument
          template={p.template}
          doc={{
            number: p.number,
            title: p.title,
            issuedAt: p.sentAt ?? p.createdAt,
            validUntil: p.validUntil,
            customer: p.customer,
            items: p.items,
            subtotal: p.subtotal,
            discount: p.discount,
            total: p.total,
            notes: p.notes,
            terms: p.terms,
            sentBy: p.createdBy?.name ?? null,
          }}
        />
        <aside className="bg-card shadow-card h-fit space-y-2 rounded-xl border p-4 lg:sticky lg:top-20">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="size-4" aria-hidden /> Seen by customer
          </h2>
          {p.firstSeenAt ? (
            <>
              <p className="text-success font-medium">
                Seen first on {formatDate(p.firstSeenAt)}, {formatTime(p.firstSeenAt)}
              </p>
              <p className="text-muted-foreground text-sm">
                {p.seenCount} {p.seenCount === 1 ? 'view' : 'views'}
                {p.lastSeenAt && p.seenCount > 1 ? ` · last ${relativeAge(p.lastSeenAt)}` : ''}
              </p>
            </>
          ) : (
            <p className="text-warning font-medium">
              Not seen yet{p.sentAt ? ` · sent ${relativeAge(p.sentAt)}` : ''}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Opening this page yourself never counts as a view.
          </p>
          {p.whatsappSends.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold">
                <MessageCircle className="size-3.5" aria-hidden /> Sent on WhatsApp
              </h3>
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {[...p.whatsappSends].reverse().map((w) => (
                  <li key={`${w.to}-${w.at}`}>
                    +91 {formatPhone(w.to)} · {relativeAge(w.at)}
                    {w.by ? ` · ${w.by.name}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </PageBody>
  );
}
