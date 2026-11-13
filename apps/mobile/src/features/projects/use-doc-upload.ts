import { useCallback, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { DOC_EXTENSIONS } from '@vastu/contracts';
import { registerProjectFile, signFileUpload } from '@/lib/api/endpoints/docs';
import { postToTicket } from '@/lib/api/upload';

export const MAX_DOC_BYTES = 25 * 1024 * 1024;

const extOf = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

/** Picks documents from the phone and uploads them to a project's Docs, one at a time. */
export function useDocUpload(projectId: string | undefined, visibility: 'TEAM' | 'CLIENT') {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  /** Returns a message to show the person (errors, or skipped files), or null when all went well. */
  const pickAndUpload = useCallback(async (): Promise<string | null> => {
    if (!projectId) return null;
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
    if (res.canceled) return null;
    setBusy(true);
    const problems: string[] = [];
    try {
      let n = 0;
      for (const a of res.assets) {
        n += 1;
        setProgress(`Uploading ${n} of ${res.assets.length}`);
        const ext = extOf(a.name);
        if (!(DOC_EXTENSIONS as readonly string[]).includes(ext)) {
          problems.push(`${a.name}: this file type is not allowed.`);
          continue;
        }
        if (a.size && a.size > MAX_DOC_BYTES) {
          problems.push(`${a.name}: over 25 MB.`);
          continue;
        }
        try {
          const ticket = await signFileUpload(projectId);
          const r = await postToTicket(
            ticket,
            { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' },
            () => undefined,
          );
          await registerProjectFile(projectId, {
            publicId: r.public_id,
            format: (r.format ?? ext).toLowerCase(),
            originalName: a.name,
            bytes: r.bytes ?? a.size ?? 1,
            ...(r.resource_type === 'image' || r.resource_type === 'raw' ? { resourceType: r.resource_type } : {}),
            visibility,
          });
        } catch (e) {
          problems.push(`${a.name}: ${e instanceof Error ? e.message : 'upload failed.'}`);
        }
      }
    } finally {
      setBusy(false);
      setProgress(null);
      void qc.invalidateQueries({ queryKey: ['projects', 'files', projectId] });
      void qc.invalidateQueries({ queryKey: ['customer', 'files', projectId] });
    }
    return problems.length ? problems.join('\n') : null;
  }, [projectId, visibility, qc]);

  return { pickAndUpload, busy, progress };
}
