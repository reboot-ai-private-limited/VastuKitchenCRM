import type { ImageInputDto, UploadTicketDto } from '@vastu/contracts';
import { MAX_IMAGES_PER_COMMENT, MAX_IMAGES_PER_POST } from '@vastu/contracts';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export { MAX_IMAGES_PER_COMMENT, MAX_IMAGES_PER_POST };

/** Why a file can't be attached, or null if it can. Checked before any upload starts. */
export function imageProblem(file: Pick<File, 'type' | 'size' | 'name'>): string | null {
  if (!file.type.startsWith('image/')) return `${file.name} isn’t a photo.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} is over 10 MB.`;
  return null;
}

/**
 * Sends one file straight to the storage provider using a signed ticket (never through our API).
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
    xhr.open('POST', ticket.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300)
        return reject(new Error('The photo couldn’t be uploaded. Try again.'));
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
    xhr.send(form);
  });
}
