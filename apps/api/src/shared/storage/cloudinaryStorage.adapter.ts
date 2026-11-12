import { createHash } from 'node:crypto';
import type { ImageDto, UploadTicketDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { FileUrls, StoragePort } from './storage.port.js';

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

  /**
   * Any file type: `auto` lets Cloudinary decide (images become images, everything else is stored
   * as a raw file). There is no `allowed_formats` here — a raw file's extension is part of its
   * id, so the API checks the extension itself when the file is registered.
   */
  signFileUpload(folder: string, now: Date = new Date()): UploadTicketDto {
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const signed = { folder, timestamp };
    return {
      url: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/auto/upload`,
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

  /**
   * `fl_attachment` makes Cloudinary answer with a download header. It is documented for images;
   * for raw files it is UNVERIFIED here — `pnpm check:storage` prints the real headers.
   */
  fileUrls(publicId: string, kind: 'IMAGE' | 'FILE'): FileUrls {
    const root = `https://res.cloudinary.com/${this.config.cloudName}`;
    if (kind === 'IMAGE') {
      const images = this.imageUrls(publicId);
      return { ...images, downloadUrl: `${root}/image/upload/fl_attachment/${publicId}` };
    }
    return {
      url: `${root}/raw/upload/${publicId}`,
      thumbUrl: null,
      downloadUrl: `${root}/raw/upload/fl_attachment/${publicId}`,
    };
  }

  /**
   * Signed `destroy`. Photos are `image` assets; other documents were stored as `raw`, so when
   * nothing is found as an image we try raw. Cloudinary answers `{ result: 'ok' | 'not found' }`.
   */
  async deleteAsset(publicId: string): Promise<void> {
    for (const type of ['image', 'raw'] as const) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = signParams({ public_id: publicId, timestamp }, this.config.apiSecret);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${type}/destroy`,
        {
          method: 'POST',
          body: new URLSearchParams({
            public_id: publicId,
            timestamp,
            api_key: this.config.apiKey,
            signature,
          }),
        },
      );
      if (!res.ok) throw AppError.unavailable('Could not remove the file. Try again.');
      const body = (await res.json()) as { result?: string };
      if (body.result === 'ok') return;
    }
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

  signFileUpload(): never {
    throw AppError.unavailable(
      'File uploads are not set up yet. Ask an admin to configure storage.',
    );
  }

  fileUrls(publicId: string): FileUrls {
    return { url: publicId, thumbUrl: null, downloadUrl: publicId };
  }

  async deleteAsset(): Promise<void> {
    /* nothing was ever uploaded */
  }
}
