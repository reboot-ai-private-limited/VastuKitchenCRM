'use client';

import type { ImportCustomersResultDto } from '@vastu/contracts';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import {
  CUSTOMER_IMPORT_BATCH,
  useImportCustomersBatch,
  useRefreshCustomers,
} from '@/lib/api/customers';
import {
  friendlyImportError,
  mapCsv,
  parseCsv,
  previewProblems,
  toCsv,
  type MappedCsv,
} from '@/lib/csv';
import { formatPhone } from '@/lib/leads';
import { cn } from '@/lib/utils';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const PREVIEW_ROWS = 8;
const TEMPLATE = toCsv([
  ['name', 'phone', 'city'],
  ['Rahul Sharma', '9876543210', 'Siliguri'],
]);

interface Outcome {
  created: number;
  linked: number;
  existing: Array<{ line: number; phone: string; customerId: string; raw: string[] }>;
  invalid: Array<{ line: number; errors: string[]; raw: string[] }>;
}

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Existing customers from a spreadsheet: people only (name, phone, city). Same flow as the leads import. */
export function ImportCustomersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [file, setFile] = useState<{ name: string; data: MappedCsv } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const batch = useImportCustomersBatch();
  const refresh = useRefreshCustomers();
  const busy = progress !== null;

  function reset() {
    setFile(null);
    setError(null);
    setOutcome(null);
    setProgress(null);
  }
  function close(o: boolean) {
    if (busy) return;
    if (!o) reset();
    onOpenChange(o);
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (f.size > MAX_BYTES) return setError('That file is over 2 MB. Split it into smaller files.');
    if (!/\.csv$/i.test(f.name) && !f.type.includes('csv') && !f.type.startsWith('text/'))
      return setError('Please choose a .csv file. In Excel or Sheets, use File → Save as → CSV.');
    const table = parseCsv(await f.text());
    if (table.length < 2)
      return setError('That file has no rows. It needs a header line and at least one customer.');
    const data = mapCsv(table);
    if (data.missing.length > 0)
      return setError(
        `The file needs a ${data.missing.join(' and ')} column. Download the template to see the layout.`,
      );
    if (data.rows.length > MAX_ROWS)
      return setError(`That file has ${data.rows.length} rows. The limit is ${MAX_ROWS} per file.`);
    setFile({ name: f.name, data });
  }

  async function run() {
    if (!file) return;
    const { rows, lines, raw } = file.data;
    const total: Outcome = { created: 0, linked: 0, existing: [], invalid: [] };
    setError(null);
    try {
      for (let start = 0; start < rows.length; start += CUSTOMER_IMPORT_BATCH) {
        setProgress({ done: start, total: rows.length });
        const slice = rows
          .slice(start, start + CUSTOMER_IMPORT_BATCH)
          .map((r) => ({ name: r.name, phone: r.phone, ...(r.city ? { city: r.city } : {}) }));
        const res: ImportCustomersResultDto = await batch.mutateAsync({ rows: slice });
        // The API numbers rows within the batch; translate back to lines in the person's file.
        const at = (r: number) => start + r - 1;
        total.created += res.created;
        total.linked += res.linked;
        total.existing.push(
          ...res.existing.map((d) => ({
            line: lines[at(d.row)] ?? d.row,
            phone: d.phone,
            customerId: d.customerId,
            raw: raw[at(d.row)] ?? [],
          })),
        );
        total.invalid.push(
          ...res.invalid.map((i) => ({
            line: lines[at(i.row)] ?? i.row,
            errors: i.errors.map(friendlyImportError),
            raw: raw[at(i.row)] ?? [],
          })),
        );
      }
      setOutcome(total);
    } catch (e) {
      const saved = total.created + total.linked;
      setError(
        (e instanceof ApiError ? e.message : 'Something went wrong.') +
          (saved > 0 ? ` ${saved} customers were already added.` : ''),
      );
      if (saved > 0) setOutcome(total);
    } finally {
      setProgress(null);
      await refresh();
    }
  }

  function downloadRejected() {
    if (!file || !outcome) return;
    const rows = [
      ...outcome.invalid.map((i) => ({ line: i.line, raw: i.raw, why: i.errors.join('; ') })),
      ...outcome.existing.map((d) => ({ line: d.line, raw: d.raw, why: 'Already a customer' })),
    ].sort((a, b) => a.line - b.line);
    download(
      'rejected-customers.csv',
      toCsv([[...file.data.header, 'Why it was skipped'], ...rows.map((r) => [...r.raw, r.why])]),
    );
  }

  const data = file?.data;
  const problems = data ? data.rows.map((r) => previewProblems(r)) : [];
  const problemCount = problems.filter((p) => p.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import customers from CSV</DialogTitle>
          <DialogDescription>
            Columns: name and phone are required; city is optional. People who are already customers
            are skipped; people who are already leads are linked to their account, never duplicated.
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Tally tone="success" label="Added" value={outcome.created} />
              <Tally tone="info" label="Linked to a lead" value={outcome.linked} />
              <Tally
                tone="warning"
                label="Skipped"
                value={outcome.existing.length + outcome.invalid.length}
              />
            </div>
            {error && (
              <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
                {error}
              </p>
            )}
            {outcome.invalid.length + outcome.existing.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Not imported</h3>
                  <Button variant="outline" size="sm" onClick={downloadRejected}>
                    <Download /> Download these rows
                  </Button>
                </div>
                <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
                  {outcome.invalid.map((i) => (
                    <li key={`i${i.line}`} className="flex gap-3 px-3 py-2">
                      <span className="text-muted-foreground tabular w-14 shrink-0 text-xs">
                        Line {i.line}
                      </span>
                      <span className="text-danger min-w-0">{i.errors.join('; ')}</span>
                    </li>
                  ))}
                  {outcome.existing.map((d) => (
                    <li key={`e${d.line}`} className="flex gap-3 px-3 py-2">
                      <span className="text-muted-foreground tabular w-14 shrink-0 text-xs">
                        Line {d.line}
                      </span>
                      <span className="min-w-0">
                        {formatPhone(d.phone)} is already a customer ·{' '}
                        <Link
                          href={`/customers/${d.customerId}`}
                          className="underline"
                          onClick={() => close(false)}
                        >
                          Open them
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : !data ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void pick(e.dataTransfer.files[0]);
              }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors',
                dragOver ? 'border-primary bg-primary-soft' : 'border-border',
              )}
            >
              <Upload className="text-muted-foreground size-6" aria-hidden />
              <p className="font-medium">Drop a CSV file here</p>
              <p className="text-muted-foreground text-xs">
                Up to {MAX_ROWS.toLocaleString('en-IN')} rows · 2 MB
              </p>
              <Button variant="outline" onClick={() => input.current?.click()}>
                Choose file
              </Button>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="CSV file"
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            {error && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
            <Button
              variant="link"
              className="px-0"
              onClick={() => download('customers-template.csv', TEMPLATE)}
            >
              <Download /> Download a template
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <FileSpreadsheet className="text-primary size-4" aria-hidden />
              <span className="font-medium">{file.name}</span>
              <span className="text-muted-foreground">
                · {data.rows.length} {data.rows.length === 1 ? 'row' : 'rows'}
                {problemCount > 0 && (
                  <span className="text-warning"> · {problemCount} with problems</span>
                )}
              </span>
              <Button variant="ghost" size="sm" className="ml-auto" disabled={busy} onClick={reset}>
                Choose another file
              </Button>
            </div>
            <ul className="divide-y overflow-hidden rounded-lg border text-sm">
              {data.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 px-3 py-2">
                  <span className="text-muted-foreground tabular w-14 shrink-0 text-xs">
                    Line {data.lines[i]}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {r.name || '—'} · {r.phone || '—'}
                    {r.city ? ` · ${r.city}` : ''}
                  </span>
                  {(problems[i]?.length ?? 0) > 0 && (
                    <span className="text-warning text-xs">{problems[i]!.join('; ')}</span>
                  )}
                </li>
              ))}
              {data.rows.length > PREVIEW_ROWS && (
                <li className="text-muted-foreground px-3 py-2 text-xs">
                  and {data.rows.length - PREVIEW_ROWS} more
                </li>
              )}
            </ul>
            {error && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => close(false)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void run()}>
                {busy
                  ? `Importing… ${progress.done} of ${progress.total}`
                  : `Import ${data.rows.length} ${data.rows.length === 1 ? 'customer' : 'customers'}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Tally({
  tone,
  label,
  value,
}: {
  tone: 'success' | 'info' | 'warning';
  label: string;
  value: number;
}) {
  const color = { success: 'text-success', info: 'text-info', warning: 'text-warning' }[tone];
  return (
    <div className="bg-card rounded-lg border p-3">
      <p className={cn('tabular text-2xl font-semibold', color)}>{value}</p>
      <p className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
        {tone === 'success' && <CheckCircle2 className="size-3" aria-hidden />}
        {label}
      </p>
    </div>
  );
}
