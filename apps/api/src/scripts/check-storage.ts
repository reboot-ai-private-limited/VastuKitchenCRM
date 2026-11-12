import { createHash } from 'node:crypto';
import { env } from '@/config/env.js';
import { signParams } from '@/shared/storage/cloudinaryStorage.adapter.js';
import { createStorage } from '@/shared/storage/createStorage.js';
import { projectFilesFolder, projectFolder } from '@/shared/storage/folders.js';

/**
 * Verifies the REAL Cloudinary setup end to end, with the credentials in `.env`:
 *   pnpm --filter @vastu/api check:storage
 *
 * It signs real tickets, uploads a tiny image and a tiny PDF into a scratch folder, checks that the
 * view / preview / download URLs answer (and how — in particular whether a raw file downloads as an
 * attachment), then deletes what it created. Prints what it learned; exits non-zero on a failure.
 */
const storage = createStorage();
let failures = 0;
const ok = (label: string, detail = '') =>
  console.warn(`  ok    ${label}${detail ? `  (${detail})` : ''}`);
const bad = (label: string, detail = '') => {
  failures++;
  console.warn(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
};

// 1x1 transparent PNG, and the smallest valid PDF.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

async function upload(
  ticket: { url: string; fields: Record<string, string>; fileField: string },
  name: string,
  bytes: Buffer,
  type: string,
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
  form.append(ticket.fileField, new Blob([bytes], { type }), name);
  const res = await fetch(ticket.url, { method: 'POST', body: form });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function head(url: string) {
  const res = await fetch(url, { method: 'GET' });
  return {
    status: res.status,
    type: res.headers.get('content-type'),
    disposition: res.headers.get('content-disposition'),
  };
}

async function destroy(publicId: string, resourceType: 'image' | 'raw') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { public_id: publicId, timestamp };
  const form = new URLSearchParams({
    ...params,
    api_key: env.CLOUDINARY_API_KEY ?? '',
    signature: signParams(params, env.CLOUDINARY_API_SECRET ?? ''),
  });
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
    { method: 'POST', body: form },
  );
  return ((await res.json()) as { result?: string }).result ?? `HTTP ${res.status}`;
}

async function main() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    console.error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in apps/api/.env.',
    );
    process.exit(2);
  }
  const scratch = `check-${createHash('sha1').update(String(Date.now())).digest('hex').slice(0, 8)}`;
  const photoFolder = projectFolder(storage.rootFolder, scratch);
  const fileFolder = projectFilesFolder(storage.rootFolder, scratch);
  console.warn(
    `Cloud "${env.CLOUDINARY_CLOUD_NAME}", folder root "${storage.rootFolder}", scratch project "${scratch}"\n`,
  );
  const created: Array<{ id: string; type: 'image' | 'raw' }> = [];

  console.warn('Photo upload (signed ticket → straight to Cloudinary)');
  const imgTicket = storage.signImageUpload(photoFolder);
  const img = await upload(imgTicket, 'pixel.png', PNG, 'image/png');
  const imgId = img.body['public_id'] as string | undefined;
  if (img.status === 200 && imgId) {
    created.push({ id: imgId, type: 'image' });
    ok('image uploaded', `public_id ${imgId}`);
    if (imgId.startsWith(`${photoFolder}/`)) ok('stored inside the project photo folder');
    else bad('not inside the photo folder', imgId);
    const urls = storage.imageUrls(imgId);
    const full = await head(urls.url);
    if (full.status === 200) ok('full-size URL answers', full.type ?? '');
    else bad('full-size URL', `HTTP ${full.status}`);
    const thumb = await head(urls.thumbUrl);
    if (thumb.status === 200) ok('thumbnail URL answers');
    else bad('thumbnail URL', `HTTP ${thumb.status}`);
  } else bad('image upload', JSON.stringify(img.body).slice(0, 200));

  console.warn('\nDocument upload (any file type)');
  const fileTicket = storage.signFileUpload(fileFolder);
  const doc = await upload(fileTicket, 'plan.pdf', PDF, 'application/pdf');
  const docId = doc.body['public_id'] as string | undefined;
  if (doc.status === 200 && docId) {
    const resourceType = (doc.body['resource_type'] as 'image' | 'raw') ?? 'raw';
    created.push({ id: docId, type: resourceType });
    ok(
      'PDF uploaded',
      `public_id ${docId}, resource_type ${resourceType}, format ${String(doc.body['format'] ?? '(none in response)')}`,
    );
    if (docId.startsWith(`${fileFolder}/`)) ok('stored inside the project FILES folder');
    else bad('not inside the files folder', docId);
    // PDFs are stored as image assets: the id has no extension, the file URL needs one.
    if (resourceType === 'image' && !docId.toLowerCase().endsWith('.pdf'))
      ok('a PDF is an image asset with no extension in its id (the API handles both shapes)');
    else if (docId.toLowerCase().endsWith('.pdf')) ok('the public_id ends in the extension');

    const urls = storage.fileUrls(docId, 'FILE', { resourceType, format: 'pdf' });
    const view = await head(urls.url);
    if (view.status === 200) ok('PDF file URL answers', view.type ?? '');
    else
      bad(
        'PDF file URL',
        `HTTP ${view.status}${view.status === 401 ? ' — Cloudinary blocks PDF delivery by default: enable Settings > Security > "PDF and ZIP files delivery"' : ''}`,
      );
    if (urls.thumbUrl) {
      const thumb = await head(urls.thumbUrl);
      if (thumb.status === 200) ok('PDF first-page preview answers', thumb.type ?? '');
      else bad('PDF first-page preview', `HTTP ${thumb.status}`);
    }
    const dl = await head(urls.downloadUrl);
    if (dl.status === 200) ok('download URL answers', dl.disposition ?? 'no content-disposition');
    else bad('download URL', `HTTP ${dl.status}`);
  } else bad('PDF upload', JSON.stringify(doc.body).slice(0, 200));

  console.warn('\nClean-up');
  for (const c of created) console.warn(`  ${c.id}: ${await destroy(c.id, c.type)}`);

  console.warn(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
