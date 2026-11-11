'use client';

import type { SalaryRowDto, SalarySheetDto } from '@vastu/contracts';
import { ChevronLeft, ChevronRight, Download, Lock, Pencil, Wallet } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import {
  downloadSalaryCsv,
  useFinalizeSalary,
  useGenerateSalary,
  useSalary,
  useUpdateSalaryRow,
} from '@/lib/api/hr';
import { formatDate, formatINR } from '@/lib/format';
import {
  currentMonth,
  describeWeeklyOff,
  isFutureMonth,
  isMonth,
  monthLabel,
  parseRupees,
  presentOverWorking,
  salaryFileName,
  shiftMonth,
} from '@/lib/hr';
import { cn } from '@/lib/utils';

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';

type Dialog = 'generate' | 'finalize' | { edit: SalaryRowDto } | null;

export function SalaryView() {
  const router = useRouter();
  const params = useSearchParams();
  const now = currentMonth();
  const month = useMemo(() => {
    const m = params.get('month');
    return isMonth(m) && !isFutureMonth(m) ? m : now;
  }, [params, now]);
  const q = useSalary(month);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [exporting, setExporting] = useState(false);
  const sheet = q.data;
  const finalized = !!sheet?.finalizedAt;
  const go = (m: string) =>
    router.replace(m === now ? '/salary' : `/salary?month=${m}`, { scroll: false });

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadSalaryCsv(month, salaryFileName(month));
    } catch (e) {
      toast.error(message(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Salary"
        description={monthLabel(month)}
        actions={
          <>
            <Button variant="outline" disabled={!sheet?.generated || exporting} onClick={exportCsv}>
              <Download /> {exporting ? 'Preparing…' : 'Export CSV'}
            </Button>
            <Button
              variant="outline"
              disabled={finalized || !sheet}
              onClick={() => setDialog('generate')}
            >
              {sheet?.generated ? 'Refresh from attendance' : 'Generate'}
            </Button>
            <Button disabled={!sheet?.generated || finalized} onClick={() => setDialog('finalize')}>
              <Lock /> Finalize
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-card shadow-card inline-flex items-center rounded-lg border p-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => go(shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{monthLabel(month)}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={month >= now}
            onClick={() => go(shiftMonth(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        {sheet?.generated && (
          <p className="text-muted-foreground text-sm">
            {sheet.weeklyOff && <>Weekly off: {describeWeeklyOff(sheet.weeklyOff)} · </>}
            <span className="tabular">{sheet.workingDays}</span> working days
          </p>
        )}
      </div>

      {finalized && sheet?.finalizedAt && (
        <p className="bg-info-soft text-info flex items-center gap-2 rounded-lg p-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden /> Finalized on{' '}
          {formatDate(sheet.finalizedAt)}. This month is locked: attendance changes and new salaries
          no longer affect it.
        </p>
      )}

      <div className="bg-card shadow-card overflow-hidden rounded-xl border">
        {q.isError && !sheet ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <div className="space-y-3 p-4" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : sheet && !sheet.generated ? (
          <EmptyState
            icon={Wallet}
            title="Not generated yet"
            description={`Work out ${monthLabel(month)} from attendance. You can edit any amount afterwards.`}
            action={
              <Button onClick={() => setDialog('generate')}>Generate {monthLabel(month)}</Button>
            }
          />
        ) : sheet ? (
          <Sheet
            sheet={sheet}
            stale={q.isPlaceholderData}
            finalized={finalized}
            onEdit={(r) => setDialog({ edit: r })}
          />
        ) : null}
      </div>

      {dialog === 'generate' && (
        <GenerateDialog
          month={month}
          hadSheet={!!sheet?.generated}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'finalize' && <FinalizeDialog month={month} onClose={() => setDialog(null)} />}
      {dialog && typeof dialog === 'object' && (
        <EditDialog
          key={dialog.edit.userId}
          month={month}
          row={dialog.edit}
          onClose={() => setDialog(null)}
        />
      )}
    </PageBody>
  );
}

function Sheet({
  sheet,
  stale,
  finalized,
  onEdit,
}: {
  sheet: SalarySheetDto;
  stale: boolean;
  finalized: boolean;
  onEdit: (r: SalaryRowDto) => void;
}) {
  if (sheet.rows.length === 0)
    return (
      <EmptyState
        icon={Wallet}
        title="No one on payroll this month"
        description="Add employees with a salary and attendance type first."
      />
    );
  return (
    <Table className={cn(stale && 'opacity-60 transition-opacity')}>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead className="text-right">Fixed</TableHead>
          <TableHead className="text-right">Present</TableHead>
          <TableHead className="hidden text-right md:table-cell">Computed</TableHead>
          <TableHead className="text-right">Payable</TableHead>
          <TableHead className="hidden lg:table-cell">Note</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Edit</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sheet.rows.map((r) => (
          <TableRow key={r.userId}>
            <TableCell>
              <span className="font-semibold">{r.name}</span>
              <span className="text-muted-foreground block text-xs">{r.designation ?? '—'}</span>
            </TableCell>
            <TableCell className="tabular text-right">{formatINR(r.fixedSalary)}</TableCell>
            <TableCell className="tabular text-right">{presentOverWorking(r)}</TableCell>
            <TableCell className="tabular text-muted-foreground hidden text-right md:table-cell">
              {formatINR(r.computedPayable)}
            </TableCell>
            <TableCell className="tabular text-right font-semibold">
              {formatINR(r.payable)}
              {r.edited && (
                <span className="bg-warning-soft text-warning ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium">
                  Edited
                </span>
              )}
            </TableCell>
            <TableCell
              className="text-muted-foreground hidden max-w-56 truncate lg:table-cell"
              title={r.note ?? undefined}
            >
              {r.note ?? '—'}
            </TableCell>
            <TableCell>
              {!finalized && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${r.name}’s payable amount`}
                  onClick={() => onEdit(r)}
                >
                  <Pencil />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="tabular text-right">
            {formatINR(sheet.totals.fixedSalary)}
          </TableCell>
          <TableCell />
          <TableCell className="hidden md:table-cell" />
          <TableCell className="tabular text-right font-semibold">
            {formatINR(sheet.totals.payable)}
          </TableCell>
          <TableCell className="hidden lg:table-cell" />
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function GenerateDialog({
  month,
  hadSheet,
  onClose,
}: {
  month: string;
  hadSheet: boolean;
  onClose: () => void;
}) {
  const gen = useGenerateSalary(month);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !gen.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hadSheet ? `Refresh ${monthLabel(month)}?` : `Generate ${monthLabel(month)}?`}
          </DialogTitle>
          <DialogDescription>
            Works each person’s pay out from attendance. It is safe to repeat: it refreshes rows you
            haven’t touched, keeps amounts you edited by hand, and is refused once the month is
            finalized.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={gen.isPending}>
            Cancel
          </Button>
          <Button
            disabled={gen.isPending}
            onClick={() =>
              gen.mutate(undefined, {
                onSuccess: () => {
                  toast.success(hadSheet ? 'Salary refreshed' : 'Salary generated');
                  onClose();
                },
                onError: (e) => setError(message(e)),
              })
            }
          >
            {gen.isPending ? 'Working…' : hadSheet ? 'Refresh' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDialog({ month, onClose }: { month: string; onClose: () => void }) {
  const fin = useFinalizeSalary(month);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && !fin.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finalize {monthLabel(month)}?</DialogTitle>
          <DialogDescription>
            This locks the month. Attendance changes will no longer affect it, and amounts can’t be
            edited. This can’t be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={fin.isPending}>
            Cancel
          </Button>
          <Button
            disabled={fin.isPending}
            onClick={() =>
              fin.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`${monthLabel(month)} finalized`);
                  onClose();
                },
                onError: (e) => setError(message(e)),
              })
            }
          >
            {fin.isPending ? 'Finalizing…' : 'Finalize month'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Set what will actually be paid; the computed amount stays visible on the sheet. */
function EditDialog({
  month,
  row,
  onClose,
}: {
  month: string;
  row: SalaryRowDto;
  onClose: () => void;
}) {
  const upd = useUpdateSalaryRow(month);
  const [amount, setAmount] = useState(String(row.payable));
  const [note, setNote] = useState(row.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const parsed = parseRupees(amount);
  return (
    <Dialog open onOpenChange={(o) => !o && !upd.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payable amount</DialogTitle>
          <DialogDescription>
            {row.name} · computed from attendance: {formatINR(row.computedPayable)} (
            {presentOverWorking(row)} days)
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!parsed.ok) return;
            setError(null);
            upd.mutate(
              {
                userId: row.userId,
                payable: parsed.value,
                ...(note.trim() ? { note: note.trim() } : {}),
              },
              {
                onSuccess: () => {
                  toast.success('Amount saved');
                  onClose();
                },
                onError: (err) => setError(message(err)),
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="sal-amount">Payable (₹)</Label>
            <Input
              id="sal-amount"
              inputMode="numeric"
              autoFocus
              value={amount}
              aria-invalid={!parsed.ok}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!parsed.ok && <p className="text-danger text-xs">{parsed.error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sal-note">Note (optional)</Label>
            <Input
              id="sal-note"
              maxLength={200}
              placeholder="e.g. Advance adjusted"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={upd.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!parsed.ok || upd.isPending}>
              {upd.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
