import type { ImageInputDto, UploadTicketDto } from '@vastu/contracts';
import { MAX_IMAGES_PER_COMMENT, MAX_IMAGES_PER_POST } from '@vastu/contracts';
import { api } from './api/client';
import { getAccessToken, hasFreshToken, refreshAccessToken } from './api/session';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export { MAX_IMAGES_PER_COMMENT, MAX_IMAGES_PER_POST };

/** Uploads go through our API (which streams them to storage), never straight from the browser. */
export async function openRelay(xhr: XMLHttpRequest, ticketUrl: string): Promise<void> {
  const token = hasFreshToken() ? getAccessToken() : await refreshAccessToken(getAccessToken());
  xhr.open('POST', `/api/uploads/relay?target=${encodeURIComponent(ticketUrl)}`);
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.setRequestHeader('X-Client', 'web');
}


/** Why a file can't be attached, or null if it can. Checked before any upload starts. */
export function imageProblem(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!file.type.startsWith('image/')) return `${file.name} isn’t a photo.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} is over 10 MB.`;
  return null;
}

/**
 * Sends one file to the storage provider using a signed ticket, relayed by our API.
 * `fields` go first, exactly as given, then the file. XMLHttpRequest because `fetch` has no upload progress.
 */
export function uploadToTicket(
  ticket: UploadTicketDto,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ImageInputDto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
    form.append(ticket.fileField, file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let reason = 'The photo couldn’t be uploaded. Try again.';
        try {
          const j = JSON.parse(xhr.responseText) as { message?: string; error?: { message?: string } };
          reason = j.message ?? j.error?.message ?? reason;
        } catch {
          /* not JSON */
        }
        return reject(new Error(reason));
      }
      try {
        const r = JSON.parse(xhr.responseText) as {
          public_id: string;
          width?: number;
          height?: number;
          bytes?: number;
        };
        resolve({
          publicId: r.public_id,
          ...(r.width ? { width: r.width } : {}),
          ...(r.height ? { height: r.height } : {}),
          ...(r.bytes ? { bytes: r.bytes } : {}),
        });
      } catch {
        reject(new Error('The photo couldn’t be uploaded. Try again.'));
      }
    };
    signal?.addEventListener('abort', () => xhr.abort());
    openRelay(xhr, ticket.url).then(() => xhr.send(form), reject);
  });
}

/** Removes an uploaded file that was never attached to anything. Best effort: failures are ignored. */
export function deleteUpload(publicId: string): void {
  void api('/uploads', { method: 'DELETE', query: { publicId } }).catch(() => undefined);
}
