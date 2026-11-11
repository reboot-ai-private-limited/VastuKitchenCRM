import type { ImageDto, UploadTicketDto } from '@vastu/contracts';

export interface FileUrls {
  url: string;
  /** A small preview, for images only. */
  thumbUrl: string | null;
  /** Opens as a download rather than in the browser. */
  downloadUrl: string;
}

/**
 * Where photos live. Provider-neutral on purpose: the API never touches file bytes — it hands out
 * a signed ticket, the client uploads straight to the provider, then reports the `publicId`.
 * Swapping Cloudinary for S3 means one new adapter behind this port.
 */
export interface StoragePort {
  /** A ticket for uploading images into `folder` (every asset must live under a folder we choose). */
  signImageUpload(folder: string, now?: Date): UploadTicketDto;
  /** Display URLs for an uploaded image. */
  imageUrls(publicId: string): Pick<ImageDto, 'url' | 'thumbUrl'>;
  /** A ticket for uploading ANY file (documents, drawings, images) into `folder`. */
  signFileUpload(folder: string, now?: Date): UploadTicketDto;
  /** URLs for a stored file: where to view it, a preview (images only) and a forced download. */
  fileUrls(publicId: string, kind: 'IMAGE' | 'FILE'): FileUrls;
  /** The environment-specific root every folder starts with (e.g. `vastu-dev`). */
  readonly rootFolder: string;
}
