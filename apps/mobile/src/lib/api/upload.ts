import type { ImageInputDto, UploadTicketDto } from '@vastu/contracts';
import { request } from '@/lib/api/client';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** A photo chosen on the phone, before it is uploaded. */
export type PickedImage = { uri: string; name: string; type: string; size?: number };

/** Why a photo can't be attached, or null if it can. Checked before any upload starts. */
export function imageProblem(img: PickedImage): string | null {
  if (!img.type.startsWith('image/')) return 'That file is not a photo.';
  if (img.size && img.size > MAX_IMAGE_BYTES) return 'That photo is over 10 MB.';
  return null;
}

/** Ask the API for a one-time signed upload ticket for a project (photos never pass through the API). */
export const signProjectUpload = (projectId: string) =>
  request<UploadTicketDto>('POST', `/projects/${encodeURIComponent(projectId)}/uploads/sign`, {});

/**
 * Sends one photo straight to the storage provider using the signed ticket.
 * `fields` go first, exactly as given, then the file. XMLHttpRequest because `fetch` has no upload progress.
 */
export function uploadToTicket(
  ticket: UploadTicketDto,
  img: PickedImage,
  onProgress: (fraction: number) => void,
): Promise<ImageInputDto> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
    form.append(ticket.fileField, { uri: img.uri, name: img.name, type: img.type } as unknown as Blob);
    const xhr = new XMLHttpRequest();
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Upload took too long. Try again on a better connection.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let reason = 'The photo could not be uploaded. Try again.';
        try {
          const j = JSON.parse(xhr.responseText) as { error?: { message?: string }; message?: string };
          reason = j.error?.message ?? j.message ?? reason;
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
        reject(new Error('The photo could not be uploaded. Try again.'));
      }
    };
    xhr.open(ticket.method, ticket.url);
    xhr.send(form);
  });
}
