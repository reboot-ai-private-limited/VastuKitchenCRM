'use client';

import type { ImageInputDto } from '@vastu/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { useSignUpload } from '@/lib/api/projects';
import { deleteUpload, imageProblem, uploadToTicket } from '@/lib/upload';

export interface UploadItem {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  image?: ImageInputDto;
}

let seq = 0;

/**
 * Photos go straight to storage with a signed ticket, with a preview and progress per file.
 * A failed file stays in the list with a retry; the post can't be sent while any file is still uploading.
 */
export function useImageUploader(projectId: string, max: number) {
  const sign = useSignUpload(projectId);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const patch = useCallback(
    (id: string, p: Partial<UploadItem>) =>
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i))),
    [],
  );

  const run = useCallback(
    async (batch: UploadItem[]) => {
      let ticket;
      try {
        ticket = await sign.mutateAsync();
      } catch (e) {
        const msg =
          e instanceof ApiError && e.status === 503
            ? 'Photo uploads are not set up yet.'
            : e instanceof ApiError
              ? e.message
              : 'Couldn’t start the upload.';
        for (const i of batch) patch(i.id, { status: 'error', error: msg });
        return;
      }
      await Promise.all(
        batch.map(async (i) => {
          try {
            const image = await uploadToTicket(ticket, i.file, (f) => patch(i.id, { progress: f }));
            if (!itemsRef.current.some((x) => x.id === i.id)) return deleteUpload(image.publicId);
            patch(i.id, { status: 'done', progress: 1, image });
          } catch (e) {
            patch(i.id, {
              status: 'error',
              error: e instanceof Error ? e.message : 'Upload failed.',
            });
          }
        }),
      );
    },
    [sign, patch],
  );

  const add = useCallback(
    (files: File[]) => {
      setProblem(null);
      const room = max - itemsRef.current.length;
      const accepted: File[] = [];
      for (const f of files) {
        const bad = imageProblem(f);
        if (bad) {
          setProblem(bad);
          continue;
        }
        if (accepted.length >= room) {
          setProblem(`You can add up to ${max} photos.`);
          break;
        }
        accepted.push(f);
      }
      if (accepted.length === 0) return;
      const batch: UploadItem[] = accepted.map((file) => ({
        id: `u${++seq}`,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'uploading',
      }));
      setItems((cur) => [...cur, ...batch]);
      void run(batch);
    },
    [max, run],
  );

  const remove = useCallback((id: string) => {
    setItems((cur) => {
      const gone = cur.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      if (gone?.image) deleteUpload(gone.image.publicId);
      return cur.filter((i) => i.id !== id);
    });
  }, []);

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      patch(id, { status: 'uploading', progress: 0, error: undefined });
      void run([{ ...item, status: 'uploading', progress: 0 }]);
    },
    [patch, run],
  );

  /** The composer was dismissed without sending: remove every photo that was already uploaded. */
  const discard = useCallback(() => {
    itemsRef.current.forEach((i) => i.image && deleteUpload(i.image.publicId));
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems([]);
    setProblem(null);
  }, []);

  const reset = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems([]);
    setProblem(null);
  }, []);

  return {
    items,
    problem,
    add,
    remove,
    retry,
    reset,
    discard,
    images: items.flatMap((i) => (i.status === 'done' && i.image ? [i.image] : [])),
    busy: items.some((i) => i.status === 'uploading'),
    failed: items.some((i) => i.status === 'error'),
  };
}
