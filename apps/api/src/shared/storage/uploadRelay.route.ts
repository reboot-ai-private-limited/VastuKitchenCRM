import { Readable } from 'node:stream';
import { Router } from 'express';
import { env } from '@/config/env.js';
import { AppError } from '@/shared/errors/AppError.js';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { DocFileModel } from '@/modules/docs/infrastructure/doc.schemas.js';
import { ComplaintModel } from '@/modules/complaints/infrastructure/complaint.schemas.js';
import { ProjectCommentModel } from '@/modules/projects/infrastructure/projectComment.schema.js';
import { ProjectPostModel } from '@/modules/projects/infrastructure/projectPost.schema.js';
import { TodoCommentModel, TodoModel } from '@/modules/todos/infrastructure/todo.schemas.js';
import { createStorage } from './createStorage.js';

const MAX_RELAY_BYTES = 60 * 1024 * 1024;

/**
 * Server-side upload relay. The browser posts the signed multipart form here (same fields the
 * signed ticket hands out) and we stream it on to Cloudinary untouched: no parsing, no buffering.
 * The browser therefore never talks to Cloudinary directly. The signature still decides what is
 * allowed (folder, formats); we only check the target is OUR Cloudinary upload endpoint.
 */
export function buildUploadRelayRouter(): Router {
  const router = Router();

  router.post('/relay', authenticate, async (req, res, next) => {
    try {
      const cloud = env.CLOUDINARY_CLOUD_NAME;
      if (!cloud) throw AppError.unavailable('Uploads are not set up yet. Ask an admin.');

      const target = typeof req.query.target === 'string' ? req.query.target : '';
      const allowed = [
        `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
        `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
      ];
      if (!allowed.includes(target)) throw AppError.badRequest('Unknown upload target.');

      const contentType = req.headers['content-type'] ?? '';
      if (!contentType.startsWith('multipart/form-data')) {
        throw AppError.badRequest('Send the upload as multipart form data.');
      }
      const length = Number(req.headers['content-length'] ?? 0);
      if (length > MAX_RELAY_BYTES) throw AppError.badRequest('That file is too large (60 MB max).');

      const upstream = await fetch(target, {
        method: 'POST',
        headers: { 'content-type': contentType, 'content-length': String(length) },
        body: Readable.toWeb(req) as unknown as ReadableStream,
        // Node needs this to stream a request body.
        duplex: 'half',
      } as RequestInit);

      res
        .status(upstream.status)
        .type(upstream.headers.get('content-type') ?? 'application/json')
        .send(await upstream.text());
    } catch (err) {
      next(err);
    }
  });

  /**
   * Cancelling an upload removes the file. Only files inside a project's folders, and only while no
   * post, comment, to-do, document or complaint uses them, so a real project photo can never be
   * deleted this way.
   */
  router.delete('/', authenticate, async (req, res, next) => {
    try {
      const storage = createStorage();
      const publicId = typeof req.query.publicId === 'string' ? req.query.publicId : '';
      const shape = new RegExp(`^${escapeRegExp(storage.rootFolder)}/projects/[a-f0-9]{24}/(files/)?[^/]+$`);
      if (!shape.test(publicId) || publicId.includes('..')) {
        throw AppError.badRequest('Unknown file.');
      }
      if (await isInUse(publicId)) throw AppError.conflict('That file is already in use.');
      await storage.deleteAsset(publicId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function isInUse(publicId: string): Promise<boolean> {
  const inImages = { 'images.publicId': publicId };
  const hits = await Promise.all([
    ProjectPostModel.exists(inImages),
    ProjectCommentModel.exists(inImages),
    TodoModel.exists(inImages),
    TodoCommentModel.exists(inImages),
    ComplaintModel.exists({ $or: [inImages, { 'resolutionImages.publicId': publicId }] }),
    DocFileModel.exists({ publicId }),
  ]);
  return hits.some(Boolean);
}
