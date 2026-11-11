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
import { useSetEmployeePassword, useUpdateEmployee } from '@/lib/api/hr';

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
