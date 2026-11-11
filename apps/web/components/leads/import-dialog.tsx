'use client';

import { LEAD_SOURCES, type ImportResultDto, type LeadSource } from '@vastu/contracts';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/api/client';
import { IMPORT_BATCH, useImportBatch, useRefreshLeads } from '@/lib/api/leads';
import {
  TEMPLATE_CSV,
  friendlyImportError,
  mapCsv,
  parseCsv,
  previewProblems,
  toCsv,
  type MappedCsv,
} from '@/lib/csv';
import { SOURCE_LABEL, formatPhone } from '@/lib/leads';
import { cn } from '@/lib/utils';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;
const PREVIEW_ROWS = 10;
const FIELD_LABEL = { name: 'Name', phone: 'Phone' } as const;

/** What came back, in file-line terms: row numbers the person can find in their spreadsheet. */
interface Outcome {
  created: number;
  duplicates: Array<{ line: number; phone: string; existingLeadId: string | null; raw: string[] }>;
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

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [file, setFile] = useState<{ name: string; data: MappedCsv } | null>(null);
  const [defaultSource, setDefaultSource] = useState<LeadSource>('OTHER');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const batch = useImportBatch();
  const refresh = useRefreshLeads();
  const busy = progress !== null;

  function reset() {
    setFile(null);
    setError(null);
    setOutcome(null);
    setProgress(null);
    setDefaultSource('OTHER');
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
    if (!/\.csv$/i.test(f.name) && !f.type.includes('csv') && !f.type.startsWith('text/')) {
      return setError('Please choose a .csv file. In Excel or Sheets, use File → Save as → CSV.');
    }
    const table = parseCsv(await f.text());
    if (table.length < 2)
      return setError('That file has no rows. It needs a header line and at least one lead.');
    const data = mapCsv(table);
    if (data.missing.length > 0) {
      return setError(
        `The file needs a ${data.missing.map((m) => FIELD_LABEL[m as keyof typeof FIELD_LABEL]).join(' and ')} column. Download the template to see the layout.`,
      );
    }
    if (data.rows.length > MAX_ROWS)
      return setError(`That file has ${data.rows.length} rows. The limit is ${MAX_ROWS} per file.`);
    setFile({ name: f.name, data });
  }

  async function run() {
    if (!file) return;
    const { rows, lines, raw } = file.data;
    const total: Outcome = { created: 0, duplicates: [], invalid: [] };
    setError(null);
    try {
      for (let start = 0; start < rows.length; start += IMPORT_BATCH) {
        setProgress({ done: start, total: rows.length });
        const res: ImportResultDto = await batch.mutateAsync({
          defaultSource,
          rows: rows.slice(start, start + IMPORT_BATCH),
        });
        // The API numbers rows within the batch; translate back to lines in the person's file.
        const at = (r: number) => start + r - 1;
        total.created += res.created;
        total.duplicates.push(
          ...res.duplicates.map((d) => ({
            line: lines[at(d.row)] ?? d.row,
            phone: d.phone,
            existingLeadId: d.existingLeadId,
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
      // Earlier batches are already saved; say so rather than pretend nothing happened.
      const saved = total.created > 0 ? ` ${total.created} leads were already added.` : '';
      setError((e instanceof ApiError ? e.message : 'Something went wrong.') + saved);
      if (total.created > 0) setOutcome(total);
    } finally {
      setProgress(null);
      await refresh();
    }
  }

  function downloadRejected() {
    if (!file || !outcome) return;
    const reasons = [
      ...outcome.invalid.map((i) => ({ line: i.line, raw: i.raw, why: i.errors.join('; ') })),
      ...outcome.duplicates.map((d) => ({
        line: d.line,
        raw: d.raw,
        why: 'Phone number already exists',
      })),
    ].sort((a, b) => a.line - b.line);
    download(
      'rejected-leads.csv',
      toCsv([
        [...file.data.header, 'Why it was skipped'],
        ...reasons.map((r) => [...r.raw, r.why]),
      ]),
    );
  }

  const data = file?.data;
  const problems = data ? data.rows.map(previewProblems) : [];
  const problemCount = problems.filter((p) => p.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Columns: name and phone are required. Optional: alt phone, email, city, source, notes.
            Phone numbers that already exist are skipped, never overwritten.
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Tally tone="success" label="Added" value={outcome.created} />
              <Tally tone="warning" label="Already existed" value={outcome.duplicates.length} />
              <Tally tone="danger" label="Skipped (invalid)" value={outcome.invalid.length} />
            </div>
            {error && (
              <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
                {error}
              </p>
            )}
            {outcome.invalid.length + outcome.duplicates.length > 0 && (
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
                  {outcome.duplicates.map((d) => (
                    <li key={`d${d.line}`} className="flex gap-3 px-3 py-2">
                      <span className="text-muted-foreground tabular w-14 shrink-0 text-xs">
                        Line {d.line}
                      </span>
                      <span className="min-w-0">
                        {formatPhone(d.phone)} already exists
                        {d.existingLeadId && (
                          <>
                            {' · '}
                            <Link
                              href={`/leads/${d.existingLeadId}`}
                              className="underline"
                              onClick={() => close(false)}
                            >
                              Open lead
                            </Link>
                          </>
                        )}
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
              onClick={() => download('leads-template.csv', TEMPLATE_CSV)}
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
            {data.ignored.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Not imported (no matching field): {data.ignored.join(', ')}
              </p>
            )}
            {!data.columns.source && (
              <div className="space-y-1.5">
                <Label htmlFor="import-source">
                  This file has no source column. Tag every lead as
                </Label>
                <Select
                  value={defaultSource}
                  onValueChange={(v) => setDefaultSource(v as LeadSource)}
                  disabled={busy}
                >
                  <SelectTrigger id="import-source" className="w-48">
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
            )}
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Line</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden sm:table-cell">City</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead>Check</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground tabular">
                        {data.lines[i]}
                      </TableCell>
                      <TableCell>{r.name || '—'}</TableCell>
                      <TableCell className="tabular">{r.phone || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell">{r.city ?? '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {r.source ?? SOURCE_LABEL[defaultSource]}
                      </TableCell>
                      <TableCell>
                        {problems[i]!.length === 0 ? (
                          <CheckCircle2 className="text-success size-4" aria-label="Looks fine" />
                        ) : (
                          <span className="text-danger inline-flex items-center gap-1 text-xs">
                            <AlertTriangle className="size-3.5" aria-hidden />
                            {problems[i]![0]}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.rows.length > PREVIEW_ROWS && (
                <p className="text-muted-foreground border-t px-3 py-2 text-xs">
                  Showing the first {PREVIEW_ROWS} of {data.rows.length} rows.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={run} disabled={busy}>
                {busy
                  ? `Importing… ${progress.done} of ${progress.total}`
                  : `Import ${data.rows.length - problemCount} ${data.rows.length - problemCount === 1 ? 'lead' : 'leads'}`}
              </Button>
            </DialogFooter>
            {problemCount > 0 && (
              <p className="text-muted-foreground -mt-2 text-right text-xs">
                Rows with problems are sent too and reported back, so you can fix and re-import
                them.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TONE = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
} as const;
function Tally({ tone, label, value }: { tone: keyof typeof TONE; label: string; value: number }) {
  return (
    <div className={cn('rounded-xl p-3 text-center', TONE[tone])}>
      <p className="tabular text-2xl font-semibold">{value}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
