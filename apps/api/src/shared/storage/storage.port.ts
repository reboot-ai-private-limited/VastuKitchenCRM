import type { ImageDto, UploadTicketDto } from '@vastu/contracts';

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
  /** The environment-specific root every folder starts with (e.g. `vastu-dev`). */
  readonly rootFolder: string;
}
