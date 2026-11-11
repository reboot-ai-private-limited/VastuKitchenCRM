import { DOC_EXTENSIONS, type PostVisibility } from '@vastu/contracts';

export interface DocFolder {
  id: string;
  projectId: string;
  /** Null at the top level. */
  parentId: string | null;
  name: string;
  createdById: string;
  createdAt: Date;
}

export interface DocFile {
  id: string;
  projectId: string;
  /** Null at the top level. */
  folderId: string | null;
  /** What it is called in Docs (editable). */
  name: string;
  originalName: string;
  /** The stored asset. Photos saved from a post point at the SAME asset: nothing is copied. */
  publicId: string;
  kind: 'IMAGE' | 'FILE';
  /** Extension, lower case. Null for a photo saved from a post (its format is not recorded). */
  format: string | null;
  bytes: number | null;
  visibility: PostVisibility;
  uploadedById: string;
  createdAt: Date;
}

export type NewDocFolder = Pick<DocFolder, 'projectId' | 'parentId' | 'name' | 'createdById'>;
export type NewDocFile = Omit<DocFile, 'id' | 'createdAt'>;
export type DocFilePatch = Partial<Pick<DocFile, 'name' | 'folderId' | 'visibility'>>;

export interface DocFileFilter {
  projectId: string;
  /** `undefined` = any folder, `null` = top level only, string = that folder. */
  folderId?: string | null | undefined;
  search?: string | undefined;
  visibilities: PostVisibility[];
}

const IMAGE_FORMATS: readonly string[] = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];

export const isImageFormat = (format: string): boolean => IMAGE_FORMATS.includes(format);

/** The server's own check of what may be stored: the type list lives here, not in the client. */
export const isAllowedFormat = (format: string): boolean =>
  (DOC_EXTENSIONS as readonly string[]).includes(format);

export const MB = 1024 * 1024;
