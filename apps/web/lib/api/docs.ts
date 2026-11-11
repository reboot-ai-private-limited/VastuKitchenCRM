'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateFolderBodyDto,
  DocFileDto,
  FolderDto,
  PostVisibility,
  RegisterFileBodyDto,
  SaveFromPhotosBodyDto,
  SaveResultDto,
  UpdateFileBodyDto,
  UpdateFolderBodyDto,
  UploadTicketDto,
} from '@vastu/contracts';
import { api } from './client';

/** Customers get an empty folder list from the API; callers show the flat shared list instead. */
export const useFolders = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: ['docs', 'folders', projectId],
    queryFn: ({ signal }) => api<FolderDto[]>(`/projects/${projectId}/folders`, { signal }),
    enabled,
  });

export interface FileScope {
  /** A folder id, or 'root' for the top level. Omit for every file in the project. */
  folderId?: string | 'root';
  search?: string;
  /** Only files shared with the customer. */
  shared?: boolean;
}

export const useFiles = (projectId: string, scope: FileScope) =>
  useQuery({
    queryKey: [
      'docs',
      'files',
      projectId,
      scope.folderId ?? null,
      scope.search ?? '',
      scope.shared ?? false,
    ],
    queryFn: ({ signal }) =>
      api<DocFileDto[]>(`/projects/${projectId}/files`, {
        query: {
          folderId: scope.folderId,
          search: scope.search,
          shared: scope.shared ? 'true' : undefined,
        },
        signal,
      }),
  });

function useRefresh(projectId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['docs', 'folders', projectId] }),
      qc.invalidateQueries({ queryKey: ['docs', 'files', projectId] }),
      // Docs events show up in the team timeline.
      qc.invalidateQueries({ queryKey: ['projects', 'timeline', projectId] }),
    ]);
}

export function useCreateFolder(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (body: CreateFolderBodyDto) =>
      api<FolderDto>(`/projects/${projectId}/folders`, { method: 'POST', body }),
    onSuccess: refresh,
  });
}

export function useUpdateFolder(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateFolderBodyDto & { id: string }) =>
      api<FolderDto>(`/folders/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}

export function useDeleteFolder(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (id: string) => api(`/folders/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

export function useUpdateFile(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateFileBodyDto & { id: string }) =>
      api<DocFileDto>(`/files/${id}`, { method: 'PATCH', body }),
    onSuccess: refresh,
  });
}

export function useDeleteFile(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (id: string) => api(`/files/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
}

/** The ticket for a DOCUMENT (`auto/upload`), not the image ticket the feed uses. */
export const useSignDocUpload = (projectId: string) =>
  useMutation({
    mutationFn: () =>
      api<UploadTicketDto>(`/projects/${projectId}/files/uploads/sign`, {
        method: 'POST',
        body: {},
      }),
  });

/** Registers a file that has just been uploaded. Registering twice returns the same document. */
export function useRegisterFile(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (body: Omit<RegisterFileBodyDto, 'visibility'> & { visibility: PostVisibility }) =>
      api<DocFileDto>(`/projects/${projectId}/files`, { method: 'POST', body }),
    onSuccess: refresh,
  });
}

export function useSaveFromPhotos(projectId: string) {
  const refresh = useRefresh(projectId);
  return useMutation({
    mutationFn: (
      body: Omit<SaveFromPhotosBodyDto, 'visibility'> & { visibility: PostVisibility },
    ) => api<SaveResultDto>(`/projects/${projectId}/files/from-photos`, { method: 'POST', body }),
    onSuccess: refresh,
  });
}
