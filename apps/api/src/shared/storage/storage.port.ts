import type { ImageDto, UploadTicketDto } from '@vastu/contracts';

export interface FileUrls {
  url: string;
  /** A small preview, for images only. */
  thumbUrl: string | null;
  /** A large picture for a viewer (a photo, or a PDF's first page). Absent for other types. */
  previewUrl?: string | null;
  /** Opens as a download rather than in the browser. */
  downloadUrl: string;
}

/** What a document's URLs depend on beyond its id: how the provider stored it, and its extension. */
export interface FileUrlExtra {
  /** `image` for photos and PDFs (first-page previews work), `raw` for other documents. */
  resourceType?: 'image' | 'raw' | null;
  format?: string | null;
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
  fileUrls(publicId: string, kind: 'IMAGE' | 'FILE', extra?: FileUrlExtra): FileUrls;
  /** Removes an uploaded asset (a cancelled upload). Missing assets are not an error. */
  deleteAsset(publicId: string): Promise<void>;
  /** The environment-specific root every folder starts with (e.g. `vastu-dev`). */
  readonly rootFolder: string;
}
