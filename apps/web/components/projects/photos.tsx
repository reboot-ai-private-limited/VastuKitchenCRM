'use client';

import type { ImageDto } from '@vastu/contracts';
import { ChevronLeft, ChevronRight, ImagePlus, RotateCw, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { UploadItem } from '@/hooks/use-image-uploader';
import { cn } from '@/lib/utils';

/** 1–4 photos in a grid; more collapse into "+N" on the fourth. Click opens the viewer. */
export function PhotoGrid({ images }: { images: ImageDto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  return (
    <>
      <div
        className={cn(
          'grid gap-1 overflow-hidden rounded-lg',
          shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
        )}
      >
        {shown.map((img, i) => (
          <button
            key={img.publicId}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1} of ${images.length}`}
            className="focus-visible:ring-ring bg-muted relative block overflow-hidden outline-none focus-visible:ring-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbUrl}
              alt=""
              loading="lazy"
              className={cn(
                'w-full object-cover',
                shown.length === 1 ? 'max-h-96' : 'aspect-square',
              )}
            />
            {extra > 0 && i === 3 && (
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-xl font-semibold text-white">
                +{extra}
              </span>
            )}
          </button>
        ))}
      </div>
      <Viewer images={images} index={open} onIndex={setOpen} />
    </>
  );
}

function Viewer({
  images,
  index,
  onIndex,
}: {
  images: ImageDto[];
  index: number | null;
  onIndex: (i: number | null) => void;
}) {
  const img = index === null ? null : images[index];
  const go = (by: number) =>
    index !== null && onIndex((index + by + images.length) % images.length);
  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent
        className="max-w-[calc(100%-1rem)] gap-2 p-2 sm:max-w-4xl"
        onKeyDown={(e) =>
          e.key === 'ArrowLeft' ? go(-1) : e.key === 'ArrowRight' ? go(1) : undefined
        }
      >
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <DialogDescription className="sr-only">
          {index !== null ? `Photo ${index + 1} of ${images.length}` : ''}
        </DialogDescription>
        {img && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Photo ${(index ?? 0) + 1} of ${images.length}`}
              className="mx-auto max-h-[80dvh] w-auto rounded-md object-contain"
            />
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 left-2 -translate-y-1/2"
                  aria-label="Previous photo"
                  onClick={() => go(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 right-2 -translate-y-1/2"
                  aria-label="Next photo"
                  onClick={() => go(1)}
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The "add photos" button and the previews with progress, used by the post and comment composers. */
export function PhotoAttach({
  items,
  problem,
  max,
  onAdd,
  onRemove,
  onRetry,
  compact,
  thumbs = true,
  button = true,
}: {
  items: UploadItem[];
  problem: string | null;
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  compact?: boolean;
  /** Show the previews (default). Turn off to render only the add button, e.g. inside a message bar. */
  thumbs?: boolean;
  /** Show the add button (default). Turn off to render only the previews and any problem message. */
  button?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      {thumbs && items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="bg-muted relative size-16 overflow-hidden rounded-md border sm:size-20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={i.preview}
                alt=""
                className={cn('size-full object-cover', i.status !== 'done' && 'opacity-50')}
              />
              {i.status === 'uploading' && (
                <div
                  className="absolute inset-x-0 bottom-0 h-1 bg-black/20"
                  role="progressbar"
                  aria-label="Uploading"
                  aria-valuenow={Math.round(i.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${Math.round(i.progress * 100)}%` }}
                  />
                </div>
              )}
              {i.status === 'error' && (
                <button
                  type="button"
                  title={i.error}
                  aria-label={`Retry upload. ${i.error ?? ''}`}
                  onClick={() => onRetry(i.id)}
                  className="bg-danger/80 absolute inset-0 grid place-items-center text-white"
                >
                  <RotateCw className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onRemove(i.id)}
                className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {button && (
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'icon-sm' : 'sm'}
            disabled={items.length >= max}
            aria-label="Add photos"
            onClick={() => input.current?.click()}
          >
            <ImagePlus /> {!compact && 'Photos'}
          </Button>
        )}
        {button && (
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-label="Choose photos"
            onChange={(e) => {
              onAdd(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        )}
        {thumbs && problem && (
          <p role="alert" className="text-danger text-xs">
            {problem}
          </p>
        )}
        {thumbs && items.some((i) => i.status === 'error') && !problem && (
          <p role="alert" className="text-danger text-xs">
            {items.find((i) => i.status === 'error')?.error} Tap the red photo to retry.
          </p>
        )}
      </div>
    </div>
  );
}
