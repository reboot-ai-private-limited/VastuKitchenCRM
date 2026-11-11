import type { ImageInputDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { isInFolder, projectFolder } from './folders.js';
import type { StoragePort } from './storage.port.js';

export interface StoredImageRef {
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

/**
 * Photos attached to a post, comment or to-do must have been uploaded into THIS project's photo
 * folder: no other project's photo, no arbitrary id. A repeated photo is kept once. Returns what to
 * store.
 */
export function projectImages(
  storage: StoragePort,
  projectId: string,
  images: ImageInputDto[] | undefined,
): StoredImageRef[] {
  const list = images ?? [];
  const folder = projectFolder(storage.rootFolder, projectId);
  list.forEach((image, index) => {
    if (!isInFolder(image.publicId, folder)) {
      throw AppError.badRequest('A photo does not belong to this project.', [
        { path: ['images', index, 'publicId'], message: 'Upload photos through this project' },
      ]);
    }
  });
  const seen = new Set<string>();
  return list
    .filter((i) => !seen.has(i.publicId) && !!seen.add(i.publicId))
    .map((i) => ({
      publicId: i.publicId,
      width: i.width ?? null,
      height: i.height ?? null,
      bytes: i.bytes ?? null,
    }));
}
