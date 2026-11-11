import type { DocFileDto, FolderDto } from '@vastu/contracts';
import type { FileView } from '../application/services/docViews.js';
import type { FolderView } from '../application/usecases/folders.usecases.js';

export const toFileDto = (v: FileView): DocFileDto => ({
  id: v.file.id,
  projectId: v.file.projectId,
  folderId: v.folderId,
  name: v.file.name,
  originalName: v.file.originalName,
  kind: v.file.kind,
  format: v.file.format,
  bytes: v.file.bytes,
  visibility: v.file.visibility,
  uploadedBy: v.uploaderName ? { id: v.file.uploadedById, name: v.uploaderName } : null,
  url: v.url,
  thumbUrl: v.thumbUrl,
  downloadUrl: v.downloadUrl,
  canDelete: v.canDelete,
  createdAt: v.file.createdAt.toISOString(),
});

export const toFolderDto = (v: FolderView): FolderDto => ({
  id: v.folder.id,
  projectId: v.folder.projectId,
  parentId: v.folder.parentId,
  name: v.folder.name,
  fileCount: v.fileCount,
  createdAt: v.folder.createdAt.toISOString(),
});
