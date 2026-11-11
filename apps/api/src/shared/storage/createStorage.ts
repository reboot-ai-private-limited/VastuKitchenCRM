import { env } from '@/config/env.js';
import { logger } from '@/shared/logging/logger.js';
import { CloudinaryStorage, UnconfiguredStorage } from './cloudinaryStorage.adapter.js';
import type { StoragePort } from './storage.port.js';

/** Cloudinary when all three credentials are set, otherwise a stand-in that explains itself. */
export function createStorage(): StoragePort {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_FOLDER } =
    env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    return new CloudinaryStorage({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
      rootFolder: CLOUDINARY_FOLDER,
    });
  }
  logger.warn('Cloudinary is not configured: photo uploads are disabled');
  return new UnconfiguredStorage(CLOUDINARY_FOLDER);
}
