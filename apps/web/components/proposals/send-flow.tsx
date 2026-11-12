'use client';

import {
  phoneSchema,
  type ProposalDto,
  type SendProposalResponseDto,
  type SendProposalWhatsappResponseDto,
} from '@vastu/contracts';
import { Check, Copy, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { ApiError } from '@/lib/api/client';
import { useSendProposal, useSendProposalWhatsapp } from '@/lib/api/proposals';
import { formatPhone } from '@/lib/leads';
import { SEND_MESSAGE_FROZEN, proposalMessagePreview } from '@/lib/proposals';

export async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error('Couldn’t copy. Select the link and copy it by hand.');
  }
}

type Result =
  | { kind: 'sent'; data: SendProposalWhatsappResponseDto }
  | { kind: 'manual'; data: SendProposalResponseDto };

const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Send on WhatsApp → confirm the number (the lead's by default, editable) → sent. The message is an
 * approved template with the proposal link, sent from the business number. A different number only
 * changes where this message goes: the lead keeps its own. Sending a draft freezes it. If WhatsApp
 * is not set up, or the person prefers it, the old manual link is one click away.
 */
export function SendFlow({
  proposal,
  open,
  onClose,
}: {
  proposal: ProposalDto;
  open: boolean;
  onClose: () => void;
}) {
  const sendWhatsapp = useSendProposalWhatsapp(proposal.id);
  const sendManual = useSendProposal(proposal.id);
  const [phone, setPhone] = useState(proposal.customer.phone);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draft = proposal.status === 'DRAFT';
  const busy = sendWhatsapp.isPending || sendManual.isPending;
  const parsed = phoneSchema.safeParse(phone);
  const changed = parsed.success && parsed.data !== proposal.customer.phone;
  const firstName = proposal.customer.name.split(/\s+/)[0] ?? proposal.customer.name;

  function close() {
    if (busy) return;
    setResult(null);
    setError(null);
    setPhone(proposal.customer.phone);
    onClose();
  }

  function sendTemplate() {
    if (!parsed.success) return setError('Enter a valid 10-digit mobile number.');
    setError(null);
    sendWhatsapp.mutate(
      { phone: parsed.data, requestId: newRequestId() },
      {
        onSuccess: (data) => setResult({ kind: 'sent', data }),
        onError: (e) =>
          setError(
            (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.') +
              (draft
                ? ' The proposal is now frozen: you can try again or share the link yourself.'
                : ''),
          ),
      },
    );
  }

  function shareManually() {
    setError(null);
    sendManual.mutate(undefined, {
      onSuccess: (data) => setResult({ kind: 'manual', data }),
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
    });
  }

  const link = result?.data.publicUrl ?? '';
  const notSetUp = result?.kind === 'sent' && result.data.delivery === 'not_configured';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="text-success size-5" aria-hidden />
                {result.kind === 'sent' && !notSetUp
                  ? `Sent to +91 ${formatPhone(result.data.sentTo)}`
                  : `Proposal ${result.data.proposal.number} is ready to share`}
              </DialogTitle>
              <DialogDescription>
                {result.kind === 'sent' && !notSetUp
                  ? 'They get a WhatsApp message with a button that opens the proposal. You will see here when they open it.'
                  : notSetUp
                    ? 'Sending from here is not set up yet, so nothing was sent. The proposal is frozen: share the link yourself.'
                    : 'The customer’s link is the same every time you send this proposal.'}
              </DialogDescription>
            </DialogHeader>
            <p className="bg-secondary tabular rounded-md p-2.5 text-xs break-all">{link}</p>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => void copyLink(link)}>
                <Copy /> Copy link
              </Button>
              {result.kind === 'sent' && !notSetUp ? (
                <Button onClick={close}>Done</Button>
              ) : (
                <Button asChild>
                  <a
                    href={result.data.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={close}
                  >
                    <MessageCircle /> Open WhatsApp
                  </a>
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{draft ? 'Send on WhatsApp' : 'Send on WhatsApp again'}</DialogTitle>
              <DialogDescription>
                {draft
                  ? SEND_MESSAGE_FROZEN
                  : 'This uses the same link the customer already has. Nothing changes on the proposal.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="wa-to">Send to</Label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm">
                  +91
                </span>
                <Input
                  id="wa-to"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={14}
                  value={phone}
                  aria-invalid={!parsed.success}
                  className="tabular pl-11"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {changed
                  ? 'Different from the lead’s number. This only changes where this message goes: the lead keeps its own number.'
                  : `${proposal.customer.name}’s number from the lead. You can change it for this message.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">The message they get</p>
              <div className="bg-secondary space-y-2 rounded-xl p-3 text-sm">
                <p>{proposalMessagePreview(firstName, proposal.number)}</p>
                <span className="bg-card text-primary inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium">
                  <ExternalLink className="size-3.5" aria-hidden /> View proposal
                </span>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" size="sm" disabled={busy} onClick={shareManually}>
                Share the link myself instead
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={close} disabled={busy}>
                  Cancel
                </Button>
                <Button disabled={busy || !parsed.success} onClick={sendTemplate}>
                  <Send />
                  {sendWhatsapp.isPending ? 'Sending…' : 'Send on WhatsApp'}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
