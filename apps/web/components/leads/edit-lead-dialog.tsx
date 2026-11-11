'use client';

import {
  LEAD_SOURCES,
  updateLeadBodySchema,
  type LeadDto,
  type LeadSource,
  type UpdateLeadBodyDto,
} from '@vastu/contracts';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { useUpdateLead } from '@/lib/api/leads';
import { SOURCE_LABEL } from '@/lib/leads';

interface Form {
  name: string;
  phone: string;
  altPhone: string;
  email: string;
  city: string;
  notes: string;
  source: LeadSource;
}

const toForm = (l: LeadDto): Form => ({
  name: l.name,
  phone: l.phone,
  altPhone: l.altPhone ?? '',
  email: l.email ?? '',
  city: l.city ?? '',
  notes: l.notes ?? '',
  source: l.source,
});

/** Only what changed is sent; an emptied optional field is sent as `null` so it is cleared, not left alone. */
export function diffLead(before: LeadDto, form: Form): UpdateLeadBodyDto {
  const was = toForm(before);
  const out: Record<string, unknown> = {};
  for (const k of ['name', 'phone', 'source'] as const)
    if (form[k].trim() !== was[k]) out[k] = form[k].trim();
  for (const k of ['altPhone', 'email', 'city', 'notes'] as const)
    if (form[k].trim() !== was[k]) out[k] = form[k].trim() === '' ? null : form[k].trim();
  return out as UpdateLeadBodyDto;
}

const FRIENDLY: Record<string, string> = {
  name: 'Enter a name.',
  phone: 'Enter a 10-digit mobile number.',
  altPhone: 'Enter a 10-digit mobile number.',
  email: 'Enter a valid email address.',
};

export function EditLeadDialog({ lead, onClose }: { lead: LeadDto; onClose: () => void }) {
  const [form, setForm] = useState<Form>(() => toForm(lead));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const update = useUpdateLead(lead.id);
  const body = diffLead(lead, form);
  const changed = Object.keys(body).length > 0;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setBanner(null);
    const parsed = updateLeadBodySchema.safeParse(body);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues)
        next[String(i.path[0] ?? '')] ||= FRIENDLY[String(i.path[0])] ?? i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success('Lead updated');
        onClose();
      },
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409)
          setErrors({ phone: 'Another lead already uses this phone number.' });
        else if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0)
          setErrors(e.fieldErrors);
        else
          setBanner(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      },
    });
  }

  const field = (
    id: Exclude<keyof Form, 'source' | 'notes'>,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`el-${id}`}>{label}</Label>
      <Input
        id={`el-${id}`}
        value={form[id]}
        aria-invalid={!!errors[id]}
        onChange={(e) => set(id, e.target.value)}
        {...props}
      />
      {errors[id] && <p className="text-danger text-xs">{errors[id]}</p>}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
          <DialogDescription>
            Changes here don’t alter proposals that were already created.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {banner && (
            <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
              {banner}
            </p>
          )}
          {field('name', 'Name', { maxLength: 120 })}
          {field('phone', 'Phone', { inputMode: 'tel' })}
          <div className="space-y-1.5">
            <Label htmlFor="el-source">Source</Label>
            <Select value={form.source} onValueChange={(v) => set('source', v as LeadSource)}>
              <SelectTrigger id="el-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field('altPhone', 'Alternate phone', { inputMode: 'tel' })}
          {field('email', 'Email', { type: 'email' })}
          {field('city', 'City', { maxLength: 500 })}
          <div className="space-y-1.5">
            <Label htmlFor="el-notes">Notes</Label>
            <Textarea
              id="el-notes"
              value={form.notes}
              maxLength={2000}
              onChange={(e) => set('notes', e.target.value)}
            />
            {errors['notes'] && <p className="text-danger text-xs">{errors['notes']}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!changed || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
