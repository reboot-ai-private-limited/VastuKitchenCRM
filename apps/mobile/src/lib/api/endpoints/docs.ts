import type {
  CreateFolderBodyDto,
  DocFileDto,
  FolderDto,
  RegisterFileBodyDto,
  SaveFromPhotosBodyDto,
  SaveResultDto,
  UpdateFileBodyDto,
  UpdateFolderBodyDto,
  UploadTicketDto,
} from '@vastu/contracts';
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

export const listProjectFolders = (projectId: string, signal?: AbortSignal) =>
  request<FolderDto[]>('GET', `/projects/${encodeURIComponent(projectId)}/folders`, undefined, { signal });

export const createProjectFolder = (projectId: string, body: CreateFolderBodyDto) =>
  request<FolderDto>('POST', `/projects/${encodeURIComponent(projectId)}/folders`, body);

export const updateFolder = (folderId: string, body: UpdateFolderBodyDto) =>
  request<FolderDto>('PATCH', `/folders/${encodeURIComponent(folderId)}`, body);

export const deleteFolder = (folderId: string) =>
  request<unknown>('DELETE', `/folders/${encodeURIComponent(folderId)}`);

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

export const updateFile = (fileId: string, body: UpdateFileBodyDto) =>
  request<DocFileDto>('PATCH', `/files/${encodeURIComponent(fileId)}`, body);

export const deleteFile = (fileId: string) =>
  request<unknown>('DELETE', `/files/${encodeURIComponent(fileId)}`);

/** A one-time signed ticket for uploading a document (any allowed file type) to a project. */
export const signFileUpload = (projectId: string) =>
  request<UploadTicketDto>('POST', `/projects/${encodeURIComponent(projectId)}/files/uploads/sign`, {});

/** Registers a file the phone has just uploaded, so it shows up in Docs. */
export const registerProjectFile = (projectId: string, body: RegisterFileBodyDto) =>
  request<DocFileDto>('POST', `/projects/${encodeURIComponent(projectId)}/files`, body);

/** "Save to Docs": photos already in a post. Nothing is uploaded again; saving twice returns the same file. */
export const saveFromPhotos = (
  projectId: string,
  body: Omit<SaveFromPhotosBodyDto, 'visibility'> & { visibility: 'TEAM' | 'CLIENT' },
) =>
  request<SaveResultDto>('POST', `/projects/${encodeURIComponent(projectId)}/files/from-photos`, body);
