import type { Request, RequestHandler } from 'express';
import type { ListFilesQueryDto, SaveResultDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { ActorRef } from '../domain/ports.js';
import type {
  CreateFolderUseCase,
  DeleteFolderUseCase,
  ListFoldersUseCase,
  UpdateFolderUseCase,
} from '../application/usecases/folders.usecases.js';
import type {
  DeleteFileUseCase,
  GetFileUseCase,
  ListFilesUseCase,
  RegisterFileUseCase,
  SaveFromPhotosUseCase,
  SignFileUploadUseCase,
  UpdateFileUseCase,
} from '../application/usecases/files.usecases.js';
import { toFileDto, toFolderDto } from './docs.mapper.js';

function actorOf(req: Request): ActorRef {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const p = (req: Request, name: string): string => String(req.params[name]);

export const makeSign = (uc: SignFileUploadUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(
      req,
      res,
      await uc.execute(actorOf(req), p(req, 'projectId')),
      'Upload ticket ready.',
    );
  });

export const makeListFolders = (uc: ListFoldersUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      (await uc.execute(actorOf(req), p(req, 'projectId'))).map(toFolderDto),
      'OK',
    );
  });

export const makeCreateFolder = (uc: CreateFolderUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toFolderDto(await uc.execute(actorOf(req), p(req, 'projectId'), req.body)),
      'Folder created.',
      201,
    );
  });

export const makeUpdateFolder = (uc: UpdateFolderUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toFolderDto(await uc.execute(actorOf(req), p(req, 'folderId'), req.body)),
      'Folder updated.',
    );
  });

export const makeDeleteFolder = (uc: DeleteFolderUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(actorOf(req), p(req, 'folderId'));
    sendSuccess(req, res, {}, 'Folder deleted.');
  });

export const makeListFiles = (uc: ListFilesUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const items = await uc.execute(
      actorOf(req),
      p(req, 'projectId'),
      req.query as unknown as ListFilesQueryDto,
    );
    sendSuccess(req, res, items.map(toFileDto), 'OK');
  });

export const makeRegisterFile = (uc: RegisterFileUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toFileDto(await uc.execute(actorOf(req), p(req, 'projectId'), req.body)),
      'File added.',
      201,
    );
  });

export const makeSaveFromPhotos = (uc: SaveFromPhotosUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const results = await uc.execute(actorOf(req), p(req, 'projectId'), req.body);
    const data: SaveResultDto = results.map((r) => ({
      file: toFileDto(r.view),
      created: r.created,
    }));
    const made = data.filter((d) => d.created).length;
    sendSuccess(
      req,
      res,
      data,
      made === data.length
        ? `Saved ${made} to Docs.`
        : `Saved ${made}; ${data.length - made} were already in Docs.`,
      201,
    );
  });

export const makeGetFile = (uc: GetFileUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toFileDto(await uc.execute(actorOf(req), p(req, 'fileId'))), 'OK');
  });

export const makeUpdateFile = (uc: UpdateFileUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toFileDto(await uc.execute(actorOf(req), p(req, 'fileId'), req.body)),
      'File updated.',
    );
  });

export const makeDeleteFile = (uc: DeleteFileUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    await uc.execute(actorOf(req), p(req, 'fileId'));
    sendSuccess(req, res, {}, 'File deleted.');
  });
