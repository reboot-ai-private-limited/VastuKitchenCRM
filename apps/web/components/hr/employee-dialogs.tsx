'use client';

import type { UserDto } from '@vastu/contracts';
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
import { useSetEmployeePassword, useSetTarget, useTargets, useUpdateEmployee } from '@/lib/api/hr';
import { formatINR } from '@/lib/format';
import { monthLabel } from '@/lib/hr';
import { MonthStepper } from './month-stepper';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';

/** Reset a password, or give a no-login employee a login. The password is never shown again or stored here. */
export function PasswordDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const set = useSetEmployeePassword(user.id);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const first = !user.canLogin;
  const short = password.length < 8;
  return (
    <Dialog open onOpenChange={(o) => !o && !set.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{first ? 'Create login' : 'Reset password'}</DialogTitle>
          <DialogDescription>
            {first
              ? `${user.name} will be able to sign in with their phone number and this password.`
              : `${user.name} is signed out everywhere and uses the new password next time.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (short) return;
            setError(null);
            set.mutate(
              { password },
              {
                onSuccess: () => {
                  toast.success(first ? 'Login created' : 'Password reset');
                  onClose();
                },
                onError: (err) => setError(message(err)),
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={password !== '' && short}
            />
            <p className="text-muted-foreground text-xs">
              At least 8 characters. Share it with them yourself.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={set.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={short || set.isPending}>
              {set.isPending ? 'Saving…' : first ? 'Create login' : 'Reset password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deactivating signs the person out immediately; their history stays. */
export function DeactivateDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const update = useUpdateEmployee(user.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate {user.name}?</DialogTitle>
          <DialogDescription>
            They will be signed out immediately and can’t sign in. Their past work and attendance
            stay. You can reactivate them any time.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { active: false },
                {
                  onSuccess: () => {
                    toast.success(`${user.name} deactivated`);
                    onClose();
                  },
                  onError: (e) => setError(message(e)),
                },
              )
            }
          >
            {update.isPending ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Set one person's rupee sales target for a month. A month nobody set carries the last one forward. */
export function TargetDialog({
  user,
  initialMonth,
  onClose,
}: {
  user: UserDto;
  initialMonth: string;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(initialMonth);
  const targets = useTargets(month);
  const set = useSetTarget(month, user.id);
  const current =
    targets.data?.month === month ? targets.data.rows.find((r) => r.userId === user.id) : undefined;
  const [draft, setDraft] = useState<{ month: string; value: string } | null>(null);
  const text = draft && draft.month === month ? draft.value : current ? String(current.amount) : '';
  const amount = Number(text);
  const invalid = text.trim() === '' || !Number.isInteger(amount) || amount < 0;
  return (
    <Dialog open onOpenChange={(o) => !o && !set.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sales target · {user.name}</DialogTitle>
          <DialogDescription>
            What {user.name} should sell in the month, in rupees. What they have won is counted
            automatically from their won leads.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            set.mutate(
              { amount },
              {
                onSuccess: () => {
                  toast.success(`Target saved for ${monthLabel(month)}`);
                  onClose();
                },
                onError: (err) => toast.error(message(err)),
              },
            );
          }}
        >
          <MonthStepper month={month} onChange={setMonth} />
          <div className="space-y-1.5">
            <Label htmlFor="target-amount">Target (₹)</Label>
            <Input
              id="target-amount"
              inputMode="numeric"
              autoFocus
              value={text}
              onChange={(e) => setDraft({ month, value: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="e.g. 600000"
            />
            <p className="text-muted-foreground text-xs">
              {current?.carriedFrom
                ? `Carried over from ${monthLabel(current.carriedFrom)}; saving sets it for ${monthLabel(month)}.`
                : !invalid
                  ? formatINR(amount)
                  : 'Whole rupees. 0 means no target.'}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={set.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={invalid || set.isPending}>
              Save target
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
