'use client';

import { RotateCw, Upload, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/docs';
import { cn } from '@/lib/utils';
import type { DocUpload } from './use-doc-uploader';

/** Drag-and-drop area around its children, plus the in-flight uploads with progress and retry. */
export function UploadZone({
  uploads,
  problems,
  onAdd,
  onRetry,
  onRemove,
  children,
}: {
  uploads: DocUpload[];
  problems: string[];
  onAdd: (files: File[]) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setOver(false);
        onAdd(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        'relative rounded-xl transition-colors',
        over && 'bg-primary-soft ring-primary ring-2',
      )}
    >
      {over && (
        <div className="bg-primary-soft/90 text-primary-hover pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Upload className="size-4" aria-hidden /> Drop to upload here
          </span>
        </div>
      )}
      {problems.length > 0 && (
        <ul
          role="alert"
          className="bg-danger-soft text-danger mb-3 space-y-0.5 rounded-md p-3 text-sm"
        >
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {uploads.length > 0 && (
        <ul className="mb-3 space-y-2" aria-label="Uploads">
          {uploads.map((u) => (
            <li
              key={u.id}
              className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {u.file.name}{' '}
                  <span className="text-muted-foreground text-xs font-normal">
                    {formatBytes(u.file.size)}
                  </span>
                </p>
                {u.status === 'uploading' ? (
                  <div
                    className="bg-muted mt-1 h-1 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label={`Uploading ${u.file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(u.progress * 100)}
                  >
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${Math.round(u.progress * 100)}%` }}
                    />
                  </div>
                ) : (
                  <p role="alert" className="text-danger text-xs">
                    {u.error}
                  </p>
                )}
              </div>
              {u.status === 'error' && (
                <Button variant="outline" size="sm" onClick={() => onRetry(u.id)}>
                  <RotateCw /> Retry
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${u.file.name}`}
                onClick={() => onRemove(u.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

/** A button that opens the file chooser. */
export function UploadButton({
  onAdd,
  disabled,
}: {
  onAdd: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button disabled={disabled} onClick={() => input.current?.click()}>
        <Upload /> Upload
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="Choose files to upload"
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </>
  );
}
