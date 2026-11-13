'use client';

import type { ProposalStatus } from '@vastu/contracts';
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
import { useDeleteProposal } from '@/lib/api/proposals';

export interface DeletableProposal {
  id: string;
  number: string;
  status: ProposalStatus;
  customer: { name: string };
}

/** What deleting means, said plainly: a sent proposal is also the customer's, so it goes for them too. */
export const deleteWarning = (p: DeletableProposal): string =>
  p.status === 'DRAFT'
    ? 'The draft is removed for good.'
    : `This also removes it for ${p.customer.name}: the link they were sent stops working. This can’t be undone.`;

/** Delete a draft or (Admin) a sent proposal. Used by the builder, the sent view and the list. */
export function DeleteProposalDialog({
  proposal,
  onClose,
  onDeleted,
  onError,
}: {
  proposal: DeletableProposal;
  onClose: () => void;
  onDeleted: () => void;
  onError?: (message: string) => void;
}) {
  const remove = useDeleteProposal();
  const draft = proposal.status === 'DRAFT';
  return (
    <Dialog open onOpenChange={(o) => !o && !remove.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {draft ? 'this draft' : `proposal ${proposal.number}`}?</DialogTitle>
          <DialogDescription>{deleteWarning(proposal)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(proposal.id, {
                onSuccess: () => {
                  toast.success(draft ? 'Draft deleted' : `${proposal.number} deleted`);
                  onDeleted();
                },
                onError: (e) => {
                  const msg = e instanceof ApiError ? e.message : 'Couldn’t delete the proposal.';
                  onClose();
                  if (onError) onError(msg);
                  else toast.error(msg);
                },
              })
            }
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
