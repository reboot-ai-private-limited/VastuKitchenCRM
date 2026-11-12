'use client';

import type { ImageInputDto, UploadTicketDto } from '@vastu/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadItem } from '@/hooks/use-image-uploader';
import { ApiError } from '@/lib/api/client';
import { deleteUpload, imageProblem, uploadToTicket } from '@/lib/upload';

let seq = 0;

/**
 * Same behaviour as the project feed's uploader (preview, progress, retry), but the signed ticket comes
 * from the complaint endpoints, which are not project-scoped. `sign` is read through a ref so changing
 * the selected project never restarts anything.
 */
export function useComplaintUploader(sign: () => Promise<UploadTicketDto>, max: number) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const signRef = useRef(sign);
  useEffect(() => {
    itemsRef.current = items;
    signRef.current = sign;
  });
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const patch = useCallback(
    (id: string, p: Partial<UploadItem>) =>
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i))),
    [],
  );

  const run = useCallback(
    async (batch: UploadItem[]) => {
      let ticket: UploadTicketDto;
      try {
        ticket = await signRef.current();
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
            const image: ImageInputDto = await uploadToTicket(ticket, i.file, (f) =>
              patch(i.id, { progress: f }),
            );
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
    [patch],
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
        id: `c${++seq}`,
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
  };
}
