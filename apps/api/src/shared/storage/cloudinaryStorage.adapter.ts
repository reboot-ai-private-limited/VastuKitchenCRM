import { createHash } from 'node:crypto';
import type { ImageDto, UploadTicketDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { StoragePort } from './storage.port.js';

/** The ticket stays valid for Cloudinary's own signature window (one hour); we say 55 minutes. */
const TICKET_MINUTES = 55;
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic,heif';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  rootFolder: string;
}

/**
 * Cloudinary signing: sort the signed parameters by name, join as `key=value` with `&`, append the
 * API secret, SHA-1 it. `file`, `api_key`, `cloud_name`, `resource_type` and the signature itself
 * are never part of it. Hand-rolled (about ten lines) instead of pulling in the SDK.
 */
export function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}

export class CloudinaryStorage implements StoragePort {
  readonly rootFolder: string;

  constructor(private readonly config: CloudinaryConfig) {
    this.rootFolder = config.rootFolder;
  }

  signImageUpload(folder: string, now: Date = new Date()): UploadTicketDto {
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const signed = { allowed_formats: ALLOWED_FORMATS, folder, timestamp };
    return {
      url: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`,
      method: 'POST',
      fileField: 'file',
      fields: {
        ...signed,
        api_key: this.config.apiKey,
        signature: signParams(signed, this.config.apiSecret),
      },
      expiresAt: new Date(now.getTime() + TICKET_MINUTES * 60_000).toISOString(),
    };
  }

  imageUrls(publicId: string): Pick<ImageDto, 'url' | 'thumbUrl'> {
    const base = `https://res.cloudinary.com/${this.config.cloudName}/image/upload`;
    // f_auto/q_auto: the right format and quality per device. Thumbs are capped at 480px wide.
    return {
      url: `${base}/f_auto,q_auto/${publicId}`,
      thumbUrl: `${base}/c_limit,w_480,f_auto,q_auto/${publicId}`,
    };
  }
}

/** Used when Cloudinary is not configured: everything else works, only uploads say why they cannot. */
export class UnconfiguredStorage implements StoragePort {
  constructor(readonly rootFolder: string) {}

  signImageUpload(): never {
    throw AppError.unavailable(
      'Photo uploads are not set up yet. Ask an admin to configure storage.',
    );
  }

  imageUrls(publicId: string): Pick<ImageDto, 'url' | 'thumbUrl'> {
    return { url: publicId, thumbUrl: publicId };
  }
}
