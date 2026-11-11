'use client';

import type { ProposalDto, SendProposalResponseDto } from '@vastu/contracts';
import { Check, Copy, MessageCircle } from 'lucide-react';
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
import { ApiError } from '@/lib/api/client';
import { useSendProposal } from '@/lib/api/proposals';
import { SEND_MESSAGE_FROZEN } from '@/lib/proposals';

export async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error('Couldn’t copy. Select the link and copy it by hand.');
  }
}

/**
 * Confirm → send → hand the person the WhatsApp link. Sending a draft freezes it; sending a sent
 * proposal again changes nothing and returns the same link, so this one flow serves both.
 * The WhatsApp link is a button, not an automatic pop-up: browsers block pop-ups that follow a network call.
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
  const send = useSendProposal(proposal.id);
  const [result, setResult] = useState<SendProposalResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draft = proposal.status === 'DRAFT';

  function close() {
    if (send.isPending) return;
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="text-success size-5" aria-hidden /> Proposal{' '}
                {result.proposal.number} is ready to share
              </DialogTitle>
              <DialogDescription>
                The customer’s link is the same every time you send this proposal.
              </DialogDescription>
            </DialogHeader>
            <p className="bg-secondary tabular rounded-md p-2.5 text-xs break-all">
              {result.publicUrl}
            </p>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => void copyLink(result.publicUrl)}>
                <Copy /> Copy link
              </Button>
              <Button asChild>
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={close}
                >
                  <MessageCircle /> Open WhatsApp
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{draft ? 'Send on WhatsApp?' : 'Share this proposal again'}</DialogTitle>
              <DialogDescription>
                {draft
                  ? SEND_MESSAGE_FROZEN
                  : 'This uses the same link the customer already has. Nothing changes on the proposal.'}
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={send.isPending}>
                Cancel
              </Button>
              <Button
                disabled={send.isPending}
                onClick={() => {
                  setError(null);
                  send.mutate(undefined, {
                    onSuccess: setResult,
                    onError: (e) =>
                      setError(
                        e instanceof ApiError
                          ? e.message
                          : 'Something went wrong. Please try again.',
                      ),
                  });
                }}
              >
                {send.isPending ? 'Sending…' : draft ? 'Freeze and send' : 'Get link'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
