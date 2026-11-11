'use client';

import { LEAD_STATUSES, type LeadDto, type LeadStatus } from '@vastu/contracts';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { useAssignLead, useChangeLeadStatus, useSalesUsers } from '@/lib/api/leads';
import { STATUS_LABEL } from '@/lib/leads';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';

/** Any → any. Lost needs a reason; Won asks for confirmation because it is final. */
export function StatusDialog({
  lead,
  initial,
  onClose,
}: {
  lead: LeadDto;
  /** Preselect a target (e.g. from a drag); otherwise the current status. */
  initial?: LeadStatus;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<LeadStatus>(initial ?? lead.status);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const change = useChangeLeadStatus();

  const lost = status === 'LOST';
  const unchanged = status === lead.status;
  const missingReason = lost && reason.trim() === '';

  function submit() {
    setError(null);
    change.mutate(
      {
        id: lead.id,
        status,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(lost ? { lostReason: reason.trim() } : {}),
      },
      {
        onSuccess: () => {
          toast.success(`${lead.name} moved to ${STATUS_LABEL[status]}`);
          onClose();
        },
        onError: (e) => setError(message(e)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !change.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>{lead.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger id="lead-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lost && (
            <div className="space-y-1.5">
              <Label htmlFor="lost-reason">Why was this lost?</Label>
              <Textarea
                id="lost-reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Went with another vendor"
              />
            </div>
          )}
          {status === 'WON' && !unchanged && (
            <p className="bg-primary-soft text-primary-hover rounded-md p-3 text-sm">
              Marking this lead as won creates the customer account and, if enabled in settings, the
              project. A won lead is then locked.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="status-note">Note (optional)</Label>
            <Textarea
              id="status-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={change.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={unchanged || missingReason || change.isPending}>
            {change.isPending ? 'Saving…' : status === 'WON' ? 'Mark as won' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NONE = '__none__';

/** Admin only: assign to an active SALES user, or unassign. */
export function AssignDialog({ lead, onClose }: { lead: LeadDto; onClose: () => void }) {
  const users = useSalesUsers(true);
  const [userId, setUserId] = useState<string>(lead.assignedTo?.id ?? NONE);
  const [error, setError] = useState<string | null>(null);
  const assign = useAssignLead();

  function submit() {
    setError(null);
    assign.mutate(
      { id: lead.id, userId: userId === NONE ? null : userId },
      {
        onSuccess: () => {
          toast.success(userId === NONE ? 'Lead unassigned' : 'Lead assigned');
          onClose();
        },
        onError: (e) => setError(message(e)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !assign.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign lead</DialogTitle>
          <DialogDescription>{lead.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="assignee">Assigned to</Label>
          <Select value={userId} onValueChange={setUserId} disabled={users.isPending}>
            <SelectTrigger id="assignee" className="w-full">
              <SelectValue placeholder={users.isPending ? 'Loading…' : 'Choose'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Unassigned</SelectItem>
              {users.data?.items.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {users.isError && <p className="text-danger text-xs">Couldn’t load the sales team.</p>}
        </div>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={assign.isPending || userId === (lead.assignedTo?.id ?? NONE)}
          >
            {assign.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
