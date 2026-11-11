'use client';

import { MAX_COMPLAINT_IMAGES, type ComplaintDto } from '@vastu/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { PhotoAttach } from '@/components/projects/photos';
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
import {
  signResolveUpload,
  useAssignComplaint,
  useCloseComplaint,
  useRefreshComplaint,
  useReopenComplaint,
  useResolveComplaint,
} from '@/lib/api/complaints';
import { useStaffUsers } from '@/lib/api/projects';
import { STALE_MESSAGE } from '@/lib/complaints';
import { useComplaintUploader } from './use-complaint-uploader';

/** A 409 means someone else acted first: say so, refresh, and let the buttons re-render from the new `can`. */
function useFail(id: string, onClose: () => void) {
  const refresh = useRefreshComplaint(id);
  return (e: unknown, set: (m: string) => void) => {
    if (e instanceof ApiError && e.status === 409) {
      toast.info(STALE_MESSAGE);
      void refresh();
      onClose();
    } else set(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
  };
}

const Err = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="text-danger text-sm">
      {text}
    </p>
  ) : null;

/** Admin only (the button is shown from `can.assign`): any active staff member, normally a technician. */
export function AssignDialog({
  complaint,
  onClose,
}: {
  complaint: ComplaintDto;
  onClose: () => void;
}) {
  const staff = useStaffUsers(true);
  const assign = useAssignComplaint(complaint.id);
  const [who, setWho] = useState(complaint.assignedTo?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const fail = useFail(complaint.id, onClose);
  // Technicians first: they are who this is usually for.
  const people = [...(staff.data?.items ?? [])]
    .filter((u) => u.role !== 'CUSTOMER')
    .sort(
      (a, b) =>
        Number(b.role === 'TECHNICIAN') - Number(a.role === 'TECHNICIAN') ||
        a.name.localeCompare(b.name),
    );

  return (
    <Dialog open onOpenChange={(o) => !o && !assign.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {complaint.assignedTo ? 'Reassign complaint' : 'Assign complaint'}
          </DialogTitle>
          <DialogDescription>{complaint.projectName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ca-who">Assign to</Label>
          <Select value={who} onValueChange={setWho} disabled={staff.isPending}>
            <SelectTrigger id="ca-who" className="w-full">
              <SelectValue placeholder={staff.isPending ? 'Loading…' : 'Choose a person'} />
            </SelectTrigger>
            <SelectContent>
              {people.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} {u.designation ? `· ${u.designation}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {staff.isError && <p className="text-danger text-xs">Couldn’t load the staff list.</p>}
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!who || who === complaint.assignedTo?.id || assign.isPending}
            onClick={() =>
              assign.mutate(
                { assigneeId: who },
                {
                  onSuccess: () => {
                    toast.success('Complaint assigned');
                    onClose();
                  },
                  onError: (e) => fail(e, setError),
                },
              )
            }
          >
            {assign.isPending ? 'Saving…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveDialog({
  complaint,
  onClose,
}: {
  complaint: ComplaintDto;
  onClose: () => void;
}) {
  const resolve = useResolveComplaint(complaint.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const up = useComplaintUploader(() => signResolveUpload(complaint.id), MAX_COMPLAINT_IMAGES);
  const fail = useFail(complaint.id, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && !resolve.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resolve complaint</DialogTitle>
          <DialogDescription>
            Say what was done. A photo of the fix helps the customer trust it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cr-note">What was done?</Label>
            <Textarea
              id="cr-note"
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <PhotoAttach
            items={up.items}
            problem={up.problem}
            max={MAX_COMPLAINT_IMAGES}
            onAdd={up.add}
            onRemove={up.remove}
            onRetry={up.retry}
          />
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resolve.isPending}>
            Cancel
          </Button>
          <Button
            disabled={note.trim() === '' || up.busy || resolve.isPending}
            onClick={() =>
              resolve.mutate(
                { note: note.trim(), ...(up.images.length ? { images: up.images } : {}) },
                {
                  onSuccess: () => {
                    toast.success('Marked as resolved');
                    onClose();
                  },
                  onError: (e) => fail(e, setError),
                },
              )
            }
          >
            {resolve.isPending ? 'Saving…' : up.busy ? 'Uploading…' : 'Mark resolved'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReopenDialog({
  complaint,
  onClose,
}: {
  complaint: ComplaintDto;
  onClose: () => void;
}) {
  const reopen = useReopenComplaint(complaint.id);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fail = useFail(complaint.id, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && !reopen.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Still not fixed?</DialogTitle>
          <DialogDescription>
            It goes back to the same technician with your reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="co-reason">What is still wrong?</Label>
          <Textarea
            id="co-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reopen.isPending}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim() === '' || reopen.isPending}
            onClick={() =>
              reopen.mutate(
                { reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Complaint reopened');
                    onClose();
                  },
                  onError: (e) => fail(e, setError),
                },
              )
            }
          >
            {reopen.isPending ? 'Sending…' : 'Reopen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CloseDialog({
  complaint,
  onClose,
}: {
  complaint: ComplaintDto;
  onClose: () => void;
}) {
  const close = useCloseComplaint(complaint.id);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fail = useFail(complaint.id, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && !close.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this complaint?</DialogTitle>
          <DialogDescription>A closed complaint is final. The customer is told.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cc-note">Note (optional)</Label>
          <Textarea
            id="cc-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Err text={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={close.isPending}>
            Cancel
          </Button>
          <Button
            disabled={close.isPending}
            onClick={() =>
              close.mutate(note.trim() ? { note: note.trim() } : {}, {
                onSuccess: () => {
                  toast.success('Complaint closed');
                  onClose();
                },
                onError: (e) => fail(e, setError),
              })
            }
          >
            {close.isPending ? 'Closing…' : 'Close complaint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
