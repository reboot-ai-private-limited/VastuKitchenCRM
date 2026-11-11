'use client';

import type { AttendanceDayDto } from '@vastu/contracts';
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
import { useRemoveDay, useSetDay } from '@/lib/api/hr';
import { formatDay } from '@/lib/format';
import { clockToInstant, correctionProblem, instantToClock } from '@/lib/hr';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';

/**
 * Admin/HR sets or corrects one person's day. For biometric staff this is how punches are entered (the
 * device is simulated); a later real device writes through the same call. A reason is required.
 */
export function CorrectDayDialog({
  userId,
  name,
  date,
  day,
  onClose,
}: {
  userId: string;
  name: string;
  date: string;
  /** The existing record, if the person has one that day. */
  day: AttendanceDayDto | null;
  onClose: () => void;
}) {
  const set = useSetDay(userId);
  const hasRecord = !!day?.inAt;
  const [inAt, setInAt] = useState(day?.inAt ? instantToClock(day.inAt) : '');
  const [outAt, setOutAt] = useState(day?.outAt ? instantToClock(day.outAt) : '');
  const [note, setNote] = useState(day?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const problem = correctionProblem({ inAt, outAt, note });

  function save() {
    setError(null);
    set.mutate(
      {
        date,
        inAt: clockToInstant(date, inAt),
        outAt: outAt ? clockToInstant(date, outAt) : null,
        note: note.trim(),
      },
      {
        onSuccess: () => {
          toast.success(hasRecord ? 'Day corrected' : 'Attendance saved');
          onClose();
        },
        onError: (e) => setError(message(e)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !set.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasRecord ? 'Correct this day' : 'Enter attendance'}</DialogTitle>
          <DialogDescription>
            {name} · {formatDay(date)} · India time
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cd-in">In</Label>
              <Input
                id="cd-in"
                type="time"
                value={inAt}
                onChange={(e) => setInAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-out">Out (optional)</Label>
              <Input
                id="cd-out"
                type="time"
                value={outAt}
                onChange={(e) => setOutAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-note">Reason</Label>
            <Input
              id="cd-note"
              value={note}
              maxLength={200}
              placeholder="e.g. Forgot to punch out"
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Shown on the day as “corrected”. There is no change history, so say why.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={set.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!!problem || set.isPending} title={problem ?? undefined}>
            {set.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveDayDialog({
  userId,
  name,
  date,
  onClose,
}: {
  userId: string;
  name: string;
  date: string;
  onClose: () => void;
}) {
  const remove = useRemoveDay(userId);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !remove.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this day?</DialogTitle>
          <DialogDescription>
            {name}’s attendance for {formatDay(date)} is removed, and the day counts as absent
            (unless it is a weekly off). Salary that has not been finalized will follow.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(date, {
                onSuccess: () => {
                  toast.success('Day removed');
                  onClose();
                },
                onError: (e) => setError(message(e)),
              })
            }
          >
            {remove.isPending ? 'Removing…' : 'Remove day'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
