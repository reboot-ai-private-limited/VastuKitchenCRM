'use client';

import type { LeadDto, ProposalDto } from '@vastu/contracts';
import { ArrowDown, ArrowUp, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageBody } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { useCreateProposal, useDeleteProposal, useUpdateProposal } from '@/lib/api/proposals';
import { formatINR } from '@/lib/format';
import {
  buildBody,
  computeTotals,
  formFromProposal,
  emptyForm,
  newItem,
  previewDiscount,
  previewItems,
  type FormErrors,
  type ProposalForm,
} from '@/lib/proposals';
import { cn } from '@/lib/utils';
import { ProposalDocument } from './proposal-document';

const MAX_ITEMS = 50;
const signature = (f: ProposalForm) =>
  JSON.stringify({
    ...f,
    items: f.items.map((i) => [i.title, i.description, i.quantity, i.unitPrice]),
  });

/**
 * Left: the form. Right: the proposal exactly as the customer will see it, updating as you type.
 * Below `lg` the two are tabs. Drafts only: a sent proposal is frozen and gets the read-only view.
 */
export function ProposalBuilder({
  proposal,
  lead,
  onSend,
}: {
  proposal: ProposalDto | null;
  lead: LeadDto | null;
  onSend: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProposalForm>(() =>
    proposal ? formFromProposal(proposal) : emptyForm(),
  );
  const [saved, setSaved] = useState<string | null>(() =>
    proposal ? signature(formFromProposal(proposal)) : null,
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const create = useCreateProposal();
  const update = useUpdateProposal(proposal?.id ?? '');
  const remove = useDeleteProposal();
  const saving = create.isPending || update.isPending;
  const dirty = saved === null || signature(form) !== saved;

  // Leaving with unsaved work is the one thing a half-built quote should never do silently.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof ProposalForm>(k: K, v: ProposalForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setItem = (key: string, patch: Partial<ProposalForm['items'][number]>) =>
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const move = (n: number, by: -1 | 1) =>
    setForm((f) => {
      const items = [...f.items];
      const [it] = items.splice(n, 1);
      items.splice(n + by, 0, it!);
      return { ...f, items };
    });

  const totals = useMemo(() => {
    const items = previewItems(form);
    return { items, ...computeTotals(items, previewDiscount(form)) };
  }, [form]);

  function save() {
    setBanner(null);
    const built = buildBody(form, proposal ? null : (lead?.id ?? null));
    if (!built.ok) {
      setErrors(built.errors);
      setBanner('Fix the highlighted fields to save.');
      setPane('edit');
      return;
    }
    setErrors({});
    const onError = (e: unknown) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) setErrors(e.fieldErrors);
      setBanner(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    };
    if (!proposal) {
      if (!built.create) return;
      create.mutate(built.create, {
        onSuccess: (p) => {
          setSaved(signature(form));
          toast.success(`Draft ${p.number} saved`);
          router.replace(`/proposals/${p.id}`);
        },
        onError,
      });
    } else {
      update.mutate(built.update, {
        onSuccess: () => {
          setSaved(signature(form));
          toast.success('Draft saved');
        },
        onError,
      });
    }
  }

  const err = (k: string) => errors[k];
  const errText = (k: string) => err(k) && <p className="text-danger mt-1 text-xs">{err(k)}</p>;

  const customer =
    proposal?.customer ??
    (lead ? { name: lead.name, phone: lead.phone, city: lead.city, siteAddress: null } : null);

  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {proposal ? `Draft ${proposal.number}` : 'New proposal'}
          </h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {customer ? `For ${customer.name}` : ''}
            {customer ? ' · ' : ''}
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {proposal && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete draft
            </Button>
          )}
          <Button variant="outline" onClick={save} disabled={saving || !dirty}>
            <Save /> Save draft
          </Button>
          {proposal && <SendButton dirty={dirty} onSend={onSend} />}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Edit or preview"
        className="bg-card shadow-card inline-flex rounded-lg border p-0.5 lg:hidden"
      >
        {(['edit', 'preview'] as const).map((p) => (
          <Button
            key={p}
            role="tab"
            aria-selected={pane === p}
            variant={pane === p ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setPane(p)}
          >
            {p === 'edit' ? 'Edit' : 'Preview'}
          </Button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className={cn('space-y-5', pane !== 'edit' && 'hidden lg:block')}>
          {banner && (
            <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
              {banner}
            </p>
          )}
          <Section title="Customer">
            {customer ? (
              <p className="text-sm">
                <span className="font-semibold">{customer.name}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {customer.phone}
                  {customer.city ? ` · ${customer.city}` : ''}
                </span>
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Copied from the lead when the proposal was created. Later edits to the lead don’t
              change it.
            </p>
          </Section>

          <Section title="Details">
            <div>
              <Label htmlFor="p-title">Title</Label>
              <Input
                id="p-title"
                value={form.title}
                maxLength={200}
                aria-invalid={!!err('title')}
                onChange={(e) => set('title', e.target.value)}
              />
              {errText('title')}
            </div>
            <div>
              <Label htmlFor="p-site">Site address</Label>
              <Input
                id="p-site"
                value={form.siteAddress}
                maxLength={500}
                onChange={(e) => set('siteAddress', e.target.value)}
              />
              {errText('siteAddress')}
            </div>
          </Section>

          <Section title="Items">
            <ul className="space-y-3">
              {form.items.map((it, n) => (
                <li key={it.key} className="bg-muted/50 space-y-2 rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`i-${it.key}-t`} className="sr-only">
                        Item {n + 1} title
                      </Label>
                      <Input
                        id={`i-${it.key}-t`}
                        placeholder="e.g. L-shaped modular kitchen"
                        value={it.title}
                        maxLength={200}
                        aria-invalid={!!err(`items.${n}.title`)}
                        onChange={(e) => setItem(it.key, { title: e.target.value })}
                      />
                      {errText(`items.${n}.title`)}
                    </div>
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move item ${n + 1} up`}
                        disabled={n === 0}
                        onClick={() => move(n, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move item ${n + 1} down`}
                        disabled={n === form.items.length - 1}
                        onClick={() => move(n, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove item ${n + 1}`}
                        disabled={form.items.length === 1}
                        onClick={() =>
                          set(
                            'items',
                            form.items.filter((x) => x.key !== it.key),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    aria-label={`Item ${n + 1} description`}
                    placeholder="Description (optional)"
                    rows={2}
                    value={it.description}
                    maxLength={1000}
                    onChange={(e) => setItem(it.key, { description: e.target.value })}
                  />
                  <div className="grid grid-cols-[5rem_1fr_auto] items-start gap-2">
                    <div>
                      <Label htmlFor={`i-${it.key}-q`} className="text-xs">
                        Qty
                      </Label>
                      <Input
                        id={`i-${it.key}-q`}
                        inputMode="decimal"
                        value={it.quantity}
                        aria-invalid={!!err(`items.${n}.quantity`)}
                        onChange={(e) => setItem(it.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`i-${it.key}-p`} className="text-xs">
                        Price each (₹)
                      </Label>
                      <Input
                        id={`i-${it.key}-p`}
                        inputMode="numeric"
                        placeholder="0"
                        value={it.unitPrice}
                        aria-invalid={!!err(`items.${n}.unitPrice`)}
                        onChange={(e) => setItem(it.key, { unitPrice: e.target.value })}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Line total</p>
                      <p className="tabular pt-2 text-sm font-semibold">
                        {formatINR(totals.lines[n] ?? 0)}
                      </p>
                    </div>
                  </div>
                  {errText(`items.${n}.quantity`)}
                  {errText(`items.${n}.unitPrice`)}
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              disabled={form.items.length >= MAX_ITEMS}
              onClick={() => set('items', [...form.items, newItem()])}
            >
              <Plus /> Add item
            </Button>
          </Section>

          <Section title="Totals">
            <div className="grid grid-cols-2 items-end gap-3">
              <div>
                <Label htmlFor="p-discount">Discount (₹, flat)</Label>
                <Input
                  id="p-discount"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.discount}
                  aria-invalid={!!err('discount')}
                  onChange={(e) => set('discount', e.target.value)}
                />
              </div>
              <dl className="tabular space-y-0.5 text-right text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatINR(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-3 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatINR(totals.total)}</dd>
                </div>
              </dl>
            </div>
            {errText('discount')}
          </Section>

          <Section title="Notes, terms and validity">
            <div>
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea
                id="p-notes"
                rows={3}
                value={form.notes}
                maxLength={2000}
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="p-terms">Terms</Label>
              <Textarea
                id="p-terms"
                rows={5}
                value={form.terms}
                maxLength={5000}
                placeholder={
                  proposal ? undefined : 'Leave empty to use the company’s default terms'
                }
                onChange={(e) => set('terms', e.target.value)}
              />
            </div>
            <div className="max-w-48">
              <Label htmlFor="p-valid">Valid until</Label>
              <Input
                id="p-valid"
                type="date"
                value={form.validUntil}
                onChange={(e) => set('validUntil', e.target.value)}
              />
              {errText('validUntil')}
            </div>
          </Section>
        </div>

        <div className={cn('lg:sticky lg:top-20', pane !== 'preview' && 'hidden lg:block')}>
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Live preview: what the customer will see
          </p>
          <ProposalDocument
            doc={{
              number: proposal?.number,
              title: form.title.trim() || 'Untitled proposal',
              issuedAt: proposal?.createdAt ?? null,
              validUntil: form.validUntil || null,
              customer: {
                name: customer?.name ?? '',
                city: customer?.city ?? null,
                siteAddress: form.siteAddress.trim() || null,
              },
              items: totals.items.map((i, n) => ({ ...i, lineTotal: totals.lines[n] ?? 0 })),
              subtotal: totals.subtotal,
              discount: previewDiscount(form),
              total: totals.total,
              notes: form.notes.trim() || null,
              terms:
                form.terms.trim() ||
                (proposal ? '' : 'The company’s default terms will appear here.'),
              sentBy: proposal?.createdBy?.name ?? null,
            }}
          />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(o) => !remove.isPending && setConfirmDelete(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>
              The draft is removed for good. Sent proposals can’t be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                proposal &&
                remove.mutate(proposal.id, {
                  onSuccess: () => {
                    setSaved(signature(form)); // nothing left to lose: don't warn on the way out
                    toast.success('Draft deleted');
                    router.replace('/proposals');
                  },
                  onError: (e) => {
                    setConfirmDelete(false);
                    setBanner(e instanceof ApiError ? e.message : 'Couldn’t delete the draft.');
                  },
                })
              }
            >
              {remove.isPending ? 'Deleting…' : 'Delete draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card shadow-card space-y-3 rounded-xl border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Sending freezes the draft, so unsaved edits must be saved first: the customer gets what is saved. */
function SendButton({ dirty, onSend }: { dirty: boolean; onSend: () => void }) {
  return (
    <Button disabled={dirty} title={dirty ? 'Save your changes first' : undefined} onClick={onSend}>
      <Send /> Send on WhatsApp
    </Button>
  );
}
