'use client';

import { addCustomerBodySchema } from '@vastu/contracts';
import { useRouter } from 'next/navigation';
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
import { useAddCustomer } from '@/lib/api/customers';

/** Someone who is already a customer but never came through the lead flow. */
export function AddCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const add = useAddCustomer();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  function close(o: boolean) {
    if (add.isPending) return;
    if (!o) {
      setName('');
      setPhone('');
      setCity('');
      setError(null);
      setExistingId(null);
    }
    onOpenChange(o);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);
    const parsed = addCustomerBodySchema.safeParse({
      name,
      phone,
      ...(city.trim() ? { city } : {}),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the details.');
    add.mutate(parsed.data, {
      onSuccess: (c) => {
        toast.success(`${c.name} added`);
        close(false);
        router.push(`/customers/${c.id}`);
      },
      onError: (er) => {
        if (er instanceof ApiError && er.status === 409) {
          const id = (er.details as { existingCustomerId?: string } | undefined)
            ?.existingCustomerId;
          if (id) setExistingId(id);
        }
        setError(er instanceof ApiError ? er.message : 'Something went wrong. Please try again.');
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a customer</DialogTitle>
            <DialogDescription>
              For someone who is already a customer. They get an account and a record, ready for
              their next project. They sign in with a WhatsApp code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cu-name">Name *</Label>
            <Input
              id="cu-name"
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cu-phone">Phone *</Label>
              <Input
                id="cu-phone"
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-city">City</Label>
              <Input
                id="cu-city"
                value={city}
                maxLength={120}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
              {existingId && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      close(false);
                      router.push(`/customers/${existingId}`);
                    }}
                  >
                    Open them
                  </button>
                </>
              )}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? 'Adding…' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
