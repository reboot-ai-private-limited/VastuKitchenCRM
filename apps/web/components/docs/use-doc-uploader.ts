'use client';

import type { PostVisibility } from '@vastu/contracts';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { useRegisterFile, useSignDocUpload } from '@/lib/api/docs';
import { fileExtension, fileProblem } from '@/lib/docs';
import { uploadFileToTicket } from '@/lib/upload-file';

export interface DocUpload {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'error';
  error?: string;
}

export interface UploadTarget {
  /** Omit for the top level. A customer's files are always top level. */
  folderId?: string;
  visibility: PostVisibility;
}

let seq = 0;

/**
 * sign → upload straight to storage → register. Successful files leave the list (the file list refetches);
 * failed ones stay with a Retry and the reason. Type problems are caught before anything is sent; size and
 * type are re-checked by the server and its message is shown as-is.
 */
export function useDocUploader(projectId: string, target: UploadTarget) {
  const sign = useSignDocUpload(projectId);
  const register = useRegisterFile(projectId);
  const [items, setItems] = useState<DocUpload[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  // The target a retry should use is the one the file was added with.
  const targets = useRef(new Map<string, UploadTarget>());

  const patch = useCallback(
    (id: string, p: Partial<DocUpload>) =>
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i))),
    [],
  );
  const drop = useCallback((id: string) => {
    targets.current.delete(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  }, []);

  const run = useCallback(
    async (batch: DocUpload[]) => {
      let ticket;
      try {
        ticket = await sign.mutateAsync();
      } catch (e) {
        const msg =
          e instanceof ApiError && e.status === 503
            ? 'Document uploads are not set up yet.'
            : e instanceof ApiError
              ? e.message
              : 'Couldn’t start the upload.';
        for (const i of batch) patch(i.id, { status: 'error', error: msg });
        return;
      }
      let saved = 0;
      await Promise.all(
        batch.map(async (i) => {
          const t = targets.current.get(i.id) ?? target;
          try {
            const up = await uploadFileToTicket(ticket, i.file, (f) =>
              patch(i.id, { progress: f }),
            );
            await register.mutateAsync({
              publicId: up.publicId,
              // Raw uploads may not report a format, so it is the file name's extension, as the API expects.
              format: fileExtension(i.file.name),
              originalName: i.file.name,
              bytes: up.bytes,
              ...(up.resourceType ? { resourceType: up.resourceType } : {}),
              ...(t.folderId ? { folderId: t.folderId } : {}),
              visibility: t.visibility,
            });
            saved++;
            drop(i.id);
          } catch (e) {
            patch(i.id, {
              status: 'error',
              error: e instanceof Error ? e.message : 'Upload failed.',
            });
          }
        }),
      );
      if (saved > 0) toast.success(saved === 1 ? 'File added' : `${saved} files added`);
    },
    [sign, register, patch, drop, target],
  );

  const add = useCallback(
    (files: File[]) => {
      const bad: string[] = [];
      const ok: File[] = [];
      for (const f of files) {
        const p = fileProblem(f);
        if (p) bad.push(p);
        else ok.push(f);
      }
      setProblems(bad);
      if (ok.length === 0) return;
      const batch: DocUpload[] = ok.map((file) => ({
        id: `d${++seq}`,
        file,
        progress: 0,
        status: 'uploading',
      }));
      for (const i of batch) targets.current.set(i.id, target);
      setItems((cur) => [...cur, ...batch]);
      void run(batch);
    },
    [run, target],
  );

  const retry = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const fresh: DocUpload = { ...item, status: 'uploading', progress: 0, error: undefined };
      setItems((cur) => cur.map((i) => (i.id === id ? fresh : i)));
      void run([fresh]);
    },
    [items, run],
  );

  return {
    items,
    problems,
    add,
    retry,
    remove: drop,
    clearProblems: () => setProblems([]),
    busy: items.some((i) => i.status === 'uploading'),
  };
}
