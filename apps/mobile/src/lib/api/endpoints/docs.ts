import type { DocFileDto } from '@vastu/contracts';
import { request } from '@/lib/api/client';

export type ProjectFilesQuery = {
  shared?: boolean;
  folderId?: string;
  search?: string;
};

function qs(params: Record<string, string | boolean | undefined>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const listProjectFiles = (projectId: string, q: ProjectFilesQuery = {}, signal?: AbortSignal) =>
  request<DocFileDto[]>(
    'GET',
    `/projects/${encodeURIComponent(projectId)}/files${qs({
      shared: q.shared === undefined ? undefined : String(q.shared),
      folderId: q.folderId,
      search: q.search,
    })}`,
    undefined,
    { signal },
  );
