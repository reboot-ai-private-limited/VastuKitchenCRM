import type { UploadTicketDto } from '@vastu/contracts';
import { openRelay } from './upload';

/** What storage answered for a document (`auto/upload`): the id and size we register with the API. */
export interface UploadedFile {
  publicId: string;
  bytes: number;
}

/**
 * Sends one document to storage with a signed ticket, relayed by our API. `fields` first,
 * then the file. Like lib/upload.ts but for documents: no width/height, and `bytes` falls back to the
 * file's own size because raw uploads may omit it.
 */
export function uploadFileToTicket(
  ticket: UploadTicketDto,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadedFile> {
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
        let reason = 'The file couldn’t be uploaded. Try again.';
        try {
          const msg = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error
            ?.message;
          if (msg) reason = msg;
        } catch {
          /* not JSON */
        }
        return reject(new Error(reason));
      }
      try {
        const r = JSON.parse(xhr.responseText) as { public_id: string; bytes?: number };
        resolve({ publicId: r.public_id, bytes: r.bytes && r.bytes > 0 ? r.bytes : file.size });
      } catch {
        reject(new Error('The file couldn’t be uploaded. Try again.'));
      }
    };
    openRelay(xhr, ticket.url).then(() => xhr.send(form), reject);
  });
}
