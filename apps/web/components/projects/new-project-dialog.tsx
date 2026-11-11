'use client';

import type { CreateProjectBodyDto, LeadDto } from '@vastu/contracts';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useLeads } from '@/lib/api/leads';
import { DEFAULT_PROJECT_FILTERS } from '@/lib/projects';
import { useCreateProject, useProjects } from '@/lib/api/projects';
import { DEFAULT_FILTERS, STATUS_LABEL, formatPhone } from '@/lib/leads';
import { cn } from '@/lib/utils';

type Mode = 'lead' | 'customer';

/** Admin: a project for a lead (its customer is found or created) or for a customer who already has one. */
export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('lead');
  const [search, setSearch] = useState('');
  const [lead, setLead] = useState<LeadDto | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateProject();

  const term = search.trim();
  const leadFilters = useMemo(() => ({ ...DEFAULT_FILTERS, search: term }), [term]);
  const leads = useLeads(leadFilters, open && mode === 'lead' && !lead);
  // There is no customer list endpoint: repeat customers come from the projects the Admin already sees.
  const existing = useProjects({ ...DEFAULT_PROJECT_FILTERS }, open && mode === 'customer');
  const customers = useMemo(() => {
    const m = new Map<string, { id: string; name: string; phone: string }>();
    for (const p of existing.data?.items ?? []) m.set(p.customer.id, p.customer);
    return [...m.values()];
  }, [existing.data]);

  function reset() {
    setMode('lead');
    setSearch('');
    setLead(null);
    setCustomerId('');
    setName('');
    setSite('');
    setValue('');
    setError(null);
  }
  function close(o: boolean) {
    if (create.isPending) return;
    if (!o) reset();
    onOpenChange(o);
  }
  function pickLead(l: LeadDto) {
    setLead(l);
    if (!name) setName(`${l.name}’s project`);
  }

  const who = mode === 'lead' ? lead?.id : customerId;
  const valueNum = value.trim() === '' ? undefined : Number(value.replace(/,/g, ''));
  const valueBad = valueNum !== undefined && (!Number.isInteger(valueNum) || valueNum < 0);
  const ready = !!who && name.trim() !== '' && !valueBad;

  function submit() {
    setError(null);
    const body: CreateProjectBodyDto = {
      ...(mode === 'lead' ? { leadId: lead!.id } : { customerId }),
      name: name.trim(),
      ...(site.trim() ? { siteAddress: site.trim() } : {}),
      ...(valueNum !== undefined ? { value: valueNum } : {}),
    };
    create.mutate(body, {
      onSuccess: (p) => {
        toast.success(`${p.name} created`);
        reset();
        onOpenChange(false);
        router.push(`/projects/${p.id}`);
      },
      onError: (e) =>
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Projects normally appear by themselves when a lead is won. Use this for repeat work or
            when automatic creation is off.
          </DialogDescription>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Customer source"
          className="bg-card inline-flex w-fit rounded-lg border p-0.5"
        >
          {(['lead', 'customer'] as const).map((m) => (
            <Button
              key={m}
              role="tab"
              aria-selected={mode === m}
              variant={mode === m ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === 'lead' ? 'From a lead' : 'Existing customer'}
            </Button>
          ))}
        </div>

        {mode === 'lead' ? (
          lead ? (
            <div className="bg-secondary flex items-center justify-between gap-3 rounded-lg p-3 text-sm">
              <span>
                <span className="font-semibold">{lead.name}</span>{' '}
                <span className="text-muted-foreground tabular">· {formatPhone(lead.phone)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setLead(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  aria-label="Search leads"
                  placeholder="Search leads by name, phone or city"
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                {leads.isPending ? (
                  <li className="p-3">
                    <Skeleton className="h-8 w-full" />
                  </li>
                ) : (leads.data?.items.length ?? 0) === 0 ? (
                  <li className="text-muted-foreground p-4 text-center text-sm">No leads found.</li>
                ) : (
                  leads.data!.items.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => pickLead(l)}
                        className="hover:bg-primary-soft/50 focus-visible:bg-primary-soft/50 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left outline-none"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{l.name}</span>
                          <span className="tabular text-muted-foreground text-xs">
                            {formatPhone(l.phone)}
                          </span>
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {STATUS_LABEL[l.status]}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="np-customer">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={existing.isPending}>
              <SelectTrigger id="np-customer" className="w-full">
                <SelectValue placeholder={existing.isPending ? 'Loading…' : 'Choose a customer'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {formatPhone(c.phone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Lists customers who already have a project.
            </p>
          </div>
        )}

        <div
          className={cn('space-y-3', !who && 'pointer-events-none opacity-50')}
          aria-disabled={!who}
        >
          <div className="space-y-1.5">
            <Label htmlFor="np-name">Project name</Label>
            <Input
              id="np-name"
              value={name}
              maxLength={160}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-site">Site address (optional)</Label>
            <Input
              id="np-site"
              value={site}
              maxLength={500}
              onChange={(e) => setSite(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-value">Value in ₹ (optional)</Label>
            <Input
              id="np-value"
              inputMode="numeric"
              value={value}
              aria-invalid={valueBad}
              onChange={(e) => setValue(e.target.value)}
            />
            {valueBad && <p className="text-danger text-xs">Enter whole rupees.</p>}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
