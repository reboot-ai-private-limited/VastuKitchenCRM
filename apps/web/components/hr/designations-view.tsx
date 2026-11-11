'use client';

import type { DesignationDto } from '@vastu/contracts';
import { ArrowLeft, Plus, Tags } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import { useCreateDesignation, useDesignationList, useUpdateDesignation } from '@/lib/api/hr';
import { cn } from '@/lib/utils';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';

/** The master list the employee form picks from. Names are unique; a rename updates everyone who holds it. */
export function DesignationsView() {
  const q = useDesignationList(true);
  const create = useCreateDesignation();
  const update = useUpdateDesignation();
  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [rename, setRename] = useState<DesignationDto | null>(null);
  const [deactivate, setDeactivate] = useState<DesignationDto | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setAddError(null);
    create.mutate(
      { name: n },
      {
        onSuccess: () => {
          toast.success(`“${n}” added`);
          setName('');
        },
        onError: (err) =>
          setAddError(
            err instanceof ApiError && err.status === 409
              ? 'That designation already exists.'
              : message(err),
          ),
      },
    );
  }

  const list = q.data ?? [];
  return (
    <PageBody>
      <div>
        <Link
          href="/employees"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Employees
        </Link>
        <PageHeader
          className="mt-1"
          title="Designations"
          description="The job titles employees can be given."
        />
      </div>

      <form
        onSubmit={add}
        className="bg-card shadow-card flex flex-wrap items-start gap-2 rounded-xl border p-4"
      >
        <div className="min-w-52 flex-1 space-y-1">
          <Label htmlFor="des-new" className="sr-only">
            New designation
          </Label>
          <Input
            id="des-new"
            placeholder="New designation, e.g. Site Supervisor"
            maxLength={60}
            value={name}
            aria-invalid={!!addError}
            onChange={(e) => setName(e.target.value)}
          />
          {addError && (
            <p role="alert" className="text-danger text-xs">
              {addError}
            </p>
          )}
        </div>
        <Button type="submit" disabled={name.trim() === '' || create.isPending}>
          <Plus /> {create.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="No designations yet"
            description="Add the first one above."
          />
        ) : (
          <ul className="divide-y">
            {list.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-medium',
                    !d.active && 'text-muted-foreground line-through',
                  )}
                >
                  {d.name}
                </span>
                {!d.active && (
                  <span className="bg-neutral-soft text-neutral rounded-full px-2 py-0.5 text-xs">
                    Inactive
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={() => setRename(d)}>
                  Rename
                </Button>
                <Switch
                  aria-label={`${d.name} is active`}
                  checked={d.active}
                  disabled={update.isPending}
                  onCheckedChange={(on) => {
                    if (!on) return setDeactivate(d);
                    update.mutate(
                      { id: d.id, active: true },
                      {
                        onSuccess: () => toast.success(`“${d.name}” is active again`),
                        onError: (e) => toast.error(message(e)),
                      },
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {rename && <RenameDialog key={rename.id} d={rename} onClose={() => setRename(null)} />}
      {deactivate && (
        <Dialog open onOpenChange={(o) => !o && !update.isPending && setDeactivate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate “{deactivate.name}”?</DialogTitle>
              <DialogDescription>
                It stops being offered when adding or editing employees. People who already have it
                keep it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeactivate(null)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: deactivate.id, active: false },
                    {
                      onSuccess: () => {
                        toast.success(`“${deactivate.name}” deactivated`);
                        setDeactivate(null);
                      },
                      onError: (e) => {
                        setDeactivate(null);
                        toast.error(message(e));
                      },
                    },
                  )
                }
              >
                {update.isPending ? 'Deactivating…' : 'Deactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageBody>
  );
}

function RenameDialog({ d, onClose }: { d: DesignationDto; onClose: () => void }) {
  const update = useUpdateDesignation();
  const [name, setName] = useState(d.name);
  const [error, setError] = useState<string | null>(null);
  const n = name.trim();
  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename designation</DialogTitle>
          <DialogDescription>Renaming updates everyone who holds “{d.name}”.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!n || n === d.name) return;
            setError(null);
            update.mutate(
              { id: d.id, name: n },
              {
                onSuccess: () => {
                  toast.success('Designation renamed');
                  onClose();
                },
                onError: (err) =>
                  setError(
                    err instanceof ApiError && err.status === 409
                      ? 'That designation already exists.'
                      : message(err),
                  ),
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="des-name">Name</Label>
            <Input
              id="des-name"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!n || n === d.name || update.isPending}>
              {update.isPending ? 'Saving…' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
