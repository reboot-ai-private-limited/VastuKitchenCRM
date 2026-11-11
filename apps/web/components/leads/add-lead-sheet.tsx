'use client';

import {
  LEAD_SOURCES,
  createLeadBodySchema,
  type CreateLeadBodyDto,
  type LeadSource,
} from '@vastu/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { useCreateLead } from '@/lib/api/leads';
import { SOURCE_LABEL } from '@/lib/leads';

interface Form {
  name: string;
  phone: string;
  altPhone: string;
  email: string;
  city: string;
  notes: string;
  source: LeadSource | '';
}
const EMPTY: Form = {
  name: '',
  phone: '',
  altPhone: '',
  email: '',
  city: '',
  notes: '',
  source: '',
};

export function AddLeadSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const create = useCreateLead();

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function close(o: boolean) {
    if (create.isPending) return;
    if (!o) {
      setForm(EMPTY);
      setErrors({});
      setBanner(null);
      setDuplicateId(null);
    }
    onOpenChange(o);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    setDuplicateId(null);
    // Empty optional fields are omitted, not sent as "".
    const raw = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''));
    const parsed = createLeadBodySchema.safeParse(raw);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0] ?? '')] ||= friendly(String(issue.path[0]), issue.message);
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate(parsed.data as CreateLeadBodyDto, {
      onSuccess: (lead) => {
        toast.success(`${lead.name} added`);
        close(false);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          setErrors({ phone: 'A lead with this phone number already exists.' });
          const id = (err.details as { existingLeadId?: string } | undefined)?.existingLeadId;
          if (id) setDuplicateId(id);
        } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
          setErrors(err.fieldErrors);
        } else
          setBanner(
            err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
          );
      },
    });
  }

  const field = (id: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${id}`}>{label}</Label>
      <Input
        id={`lead-${id}`}
        value={form[id]}
        onChange={(e) => set(id, e.target.value as never)}
        aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? `lead-${id}-err` : undefined}
        {...props}
      />
      {errors[id] && (
        <p id={`lead-${id}-err`} className="text-danger text-xs">
          {errors[id]}{' '}
          {id === 'phone' && duplicateId && (
            <Link href={`/leads/${duplicateId}`} className="underline">
              Open lead
            </Link>
          )}
        </p>
      )}
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex min-h-full flex-col">
          <SheetHeader>
            <SheetTitle>Add lead</SheetTitle>
            <SheetDescription>One lead per phone number.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4">
            {banner && (
              <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
                {banner}
              </p>
            )}
            {field('name', 'Name *', { autoComplete: 'off', maxLength: 120 })}
            {field('phone', 'Phone *', {
              inputMode: 'tel',
              placeholder: '10-digit mobile',
              autoComplete: 'off',
            })}
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Source *</Label>
              <Select value={form.source} onValueChange={(v) => set('source', v as LeadSource)}>
                <SelectTrigger id="lead-source" className="w-full" aria-invalid={!!errors.source}>
                  <SelectValue placeholder="Where did this lead come from?" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.source && <p className="text-danger text-xs">{errors.source}</p>}
            </div>
            {field('altPhone', 'Alternate phone', { inputMode: 'tel', autoComplete: 'off' })}
            {field('email', 'Email', { type: 'email', autoComplete: 'off' })}
            {field('city', 'City', { autoComplete: 'off', maxLength: 500 })}
            <div className="space-y-1.5">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                value={form.notes}
                maxLength={2000}
                onChange={(e) => set('notes', e.target.value)}
              />
              {errors.notes && <p className="text-danger text-xs">{errors.notes}</p>}
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add lead'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function friendly(field: string, message: string): string {
  if (field === 'name') return 'Enter a name.';
  if (field === 'source') return 'Choose a source.';
  if (field === 'phone' || field === 'altPhone') return 'Enter a 10-digit mobile number.';
  if (field === 'email') return 'Enter a valid email address.';
  return message;
}
