'use client';

import type { DesignMediaInputDto, UploadTicketDto } from '@vastu/contracts';
import { CheckCircle2, FileText, Film, ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { signLeadDesignUpload, useCompleteLeadDesign } from '@/lib/api/leads';
import {
  deleteUpload,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_MB,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  openRelay,
  VISIT_MAX_MEDIA,
} from '@/lib/upload';

interface UploadedDesignItem {
  localId: string;
  previewUrl: string | null;
  name: string;
  kind: 'IMAGE' | 'VIDEO' | 'FILE';
  progress: number;
  media?: DesignMediaInputDto;
  error?: string;
}

function uploadDesignFileToTicket(
  ticket: UploadTicketDto,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<DesignMediaInputDto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
    form.append(ticket.fileField, file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let reason = 'Could not upload file. Try again.';
        try {
          const j = JSON.parse(xhr.responseText) as {
            message?: string;
            error?: { message?: string };
          };
          reason = j.message ?? j.error?.message ?? reason;
        } catch {
          /* ignore */
        }
        return reject(new Error(reason));
      }
      try {
        const r = JSON.parse(xhr.responseText) as {
          public_id: string;
          resource_type?: string;
          format?: string;
          width?: number;
          height?: number;
          bytes?: number;
          duration?: number;
        };
        const kind = file.type.startsWith('video/')
          ? 'VIDEO'
          : file.type.startsWith('image/')
            ? 'IMAGE'
            : 'FILE';
        const resourceType =
          r.resource_type === 'image' || r.resource_type === 'video' || r.resource_type === 'raw'
            ? r.resource_type
            : undefined;
        resolve({
          kind,
          publicId: r.public_id,
          fileName: file.name,
          ...(r.width ? { width: Math.round(r.width) } : {}),
          ...(r.height ? { height: Math.round(r.height) } : {}),
          ...(r.bytes ? { bytes: Math.round(r.bytes) } : { bytes: file.size }),
          ...(typeof r.duration === 'number' ? { durationSec: Math.round(r.duration) } : {}),
          ...(resourceType ? { resourceType } : {}),
          ...(r.format ? { format: r.format } : {}),
        });
      } catch {
        reject(new Error('Could not read upload response.'));
      }
    };
    openRelay(xhr, ticket.url).then(() => xhr.send(form), reject);
  });
}

export function CompleteDesignDialog({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const complete = useCompleteLeadDesign(leadId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<UploadedDesignItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploading = items.some((i) => !i.media && !i.error);

  function cleanupUnused(list: UploadedDesignItem[]) {
    for (const item of list) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.media) deleteUpload(item.media.publicId);
    }
  }

  function close(nextOpen: boolean) {
    if (complete.isPending || uploading) return;
    if (!nextOpen) {
      cleanupUnused(items);
      setNote('');
      setItems([]);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const remaining = VISIT_MAX_MEDIA - items.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${VISIT_MAX_MEDIA} files per design submission.`);
      return;
    }
    const picked = Array.from(fileList).slice(0, remaining);
    const valid: File[] = [];
    for (const f of picked) {
      const isImg = f.type.startsWith('image/');
      const isVid = f.type.startsWith('video/');
      if (isImg && f.size > MAX_IMAGE_BYTES) {
        setError(`${f.name} is over ${MAX_IMAGE_MB} MB.`);
        continue;
      }
      if (f.size > MAX_VIDEO_BYTES) {
        setError(`${f.name} is over ${MAX_VIDEO_MB} MB.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;

    let ticket: UploadTicketDto;
    try {
      ticket = await signLeadDesignUpload(leadId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start upload.');
      return;
    }

    const entries: UploadedDesignItem[] = valid.map((f) => {
      const kind = f.type.startsWith('video/')
        ? 'VIDEO'
        : f.type.startsWith('image/')
          ? 'IMAGE'
          : 'FILE';
      return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        previewUrl: kind === 'FILE' ? null : URL.createObjectURL(f),
        name: f.name,
        kind,
        progress: 0,
      };
    });
    setItems((prev) => [...prev, ...entries]);

    await Promise.all(
      valid.map(async (file, idx) => {
        const entry = entries[idx]!;
        try {
          const media = await uploadDesignFileToTicket(ticket, file, (p) => {
            setItems((prev) =>
              prev.map((x) => (x.localId === entry.localId ? { ...x, progress: p } : x)),
            );
          });
          setItems((prev) =>
            prev.map((x) => (x.localId === entry.localId ? { ...x, progress: 1, media } : x)),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed.';
          setItems((prev) =>
            prev.map((x) => (x.localId === entry.localId ? { ...x, error: msg } : x)),
          );
        }
      }),
    );
  }

  function removeItem(localId: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.localId === localId);
      if (target) {
        if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
        if (target.media) deleteUpload(target.media.publicId);
      }
      return prev.filter((i) => i.localId !== localId);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    const uploaded = items.flatMap((i) => (i.media ? [i.media] : []));
    if (!note.trim() && uploaded.length === 0) {
      setError('Add a note or upload at least one design image, video, or file.');
      return;
    }
    setError(null);
    complete.mutate(
      {
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(uploaded.length > 0 ? { media: uploaded } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Design marked completed');
          for (const i of items) if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
          setNote('');
          setItems([]);
          setError(null);
          onOpenChange(false);
        },
        onError: (er) =>
          setError(er instanceof ApiError ? er.message : 'Could not save design. Try again.'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Upload design &amp; mark completed</DialogTitle>
            <DialogDescription>
              Attach 3D renders, walkthrough videos, or CAD/PDF drawings (up to {VISIT_MAX_MEDIA}{' '}
              files). Submitting moves this lead to <strong>Design estimate done</strong> and
              notifies the sales owner.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="bg-danger-soft text-danger rounded-md p-2.5 text-xs">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="design-note">Design / estimate notes</Label>
            <Textarea
              id="design-note"
              rows={3}
              maxLength={2000}
              placeholder="e.g. 3D renders and initial BOQ estimate ready for client presentation..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Design images, videos &amp; files</Label>
              <span className="text-muted-foreground text-xs">
                {items.length}/{VISIT_MAX_MEDIA}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf,.dwg,.dxf,.zip"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={items.length >= VISIT_MAX_MEDIA}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus /> Add design files
            </Button>

            {items.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {items.map((item) => (
                  <div
                    key={item.localId}
                    className="bg-secondary relative aspect-square overflow-hidden rounded-lg border"
                  >
                    {item.kind === 'VIDEO' && item.previewUrl ? (
                      <video src={item.previewUrl} muted className="size-full object-cover" />
                    ) : item.kind === 'IMAGE' && item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                        <FileText className="text-muted-foreground size-6" aria-hidden />
                        <span className="line-clamp-2 text-[10px] font-medium break-all">
                          {item.name}
                        </span>
                      </div>
                    )}
                    {item.kind === 'VIDEO' && (
                      <span className="bg-foreground/70 text-background absolute bottom-1 left-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        <Film className="size-2.5" aria-hidden /> Video
                      </span>
                    )}
                    {!item.media && !item.error && (
                      <div className="bg-background/70 absolute inset-0 grid place-items-center">
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <Loader2 className="size-3.5 animate-spin" />{' '}
                          {Math.round(item.progress * 100)}%
                        </span>
                      </div>
                    )}
                    {item.error && (
                      <div className="bg-danger/85 text-white absolute inset-0 grid place-items-center p-1.5 text-center text-[10px]">
                        {item.error}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.localId)}
                      className="bg-background/85 text-foreground hover:bg-background absolute top-1 right-1 rounded-full p-0.5 shadow-sm"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={complete.isPending || uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={complete.isPending || uploading}>
              <CheckCircle2 />
              {complete.isPending
                ? 'Saving…'
                : uploading
                  ? 'Uploading…'
                  : 'Mark design completed'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
