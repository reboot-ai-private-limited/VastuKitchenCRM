import type { StoragePort } from '@/shared/storage/storage.port.js';
import type { DocFile } from '../../domain/doc.entity.js';
import type { DirectoryUser, UserDirectoryPort } from '../../domain/ports.js';
import type { Viewer } from './docsAccess.js';

export interface FileView {
  file: DocFile;
  uploaderName: string | null;
  url: string;
  thumbUrl: string | null;
  downloadUrl: string;
  canDelete: boolean;
  /** Hidden from the customer, who is not shown the folder structure. */
  folderId: string | null;
}

export class DocViewBuilder {
  constructor(
    private readonly directory: UserDirectoryPort,
    private readonly storage: StoragePort,
  ) {}

  async build(files: DocFile[], viewer: Viewer): Promise<FileView[]> {
    const users = new Map<string, DirectoryUser>(
      (await this.directory.find([...new Set(files.map((f) => f.uploadedById))])).map((u) => [
        u.id,
        u,
      ]),
    );
    return files.map((file) => ({
      file,
      uploaderName: users.get(file.uploadedById)?.name ?? null,
      ...this.storage.fileUrls(file.publicId, file.kind),
      canDelete: viewer.isAdmin || file.uploadedById === viewer.actor.id,
      folderId: viewer.isCustomer ? null : file.folderId,
    }));
  }
}
