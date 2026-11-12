import type { Request, RequestHandler } from 'express';
import type { ListComplaintsQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { Viewer } from '../domain/complaint.entity.js';
import type {
  AddComplaintCommentUseCase,
  AssignComplaintUseCase,
  CloseComplaintUseCase,
  CountComplaintsUseCase,
  DeleteComplaintCommentUseCase,
  GetComplaintUseCase,
  ListComplaintsUseCase,
  RaiseComplaintUseCase,
  ReopenComplaintUseCase,
  ResolveComplaintUseCase,
  SignRaiseUploadUseCase,
  SignResolveUploadUseCase,
  SignCommentUploadUseCase,
} from '../application/usecases/complaints.usecases.js';
import { toComplaintDto } from './complaints.mapper.js';

function actorOf(req: Request): Viewer {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const id = (req: Request): string => String(req.params['complaintId']);

export const makeSignRaise = (uc: SignRaiseUploadUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(
      req,
      res,
      await uc.execute(actorOf(req), String(req.body.projectId)),
      'Upload ticket ready.',
    );
  });

export const makeSignResolve = (uc: SignResolveUploadUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(req, res, await uc.execute(actorOf(req), id(req)), 'Upload ticket ready.');
  });

export const makeSignComment = (uc: SignCommentUploadUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(req, res, await uc.execute(actorOf(req), id(req)), 'Upload ticket ready.');
  });

export const makeRaise = (uc: RaiseComplaintUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toComplaintDto(await uc.execute(actorOf(req), req.body)),
      'Complaint raised.',
      201,
    );
  });

export const makeList = (uc: ListComplaintsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const page = await uc.execute(actorOf(req), req.query as unknown as ListComplaintsQueryDto);
    sendSuccess(req, res, { ...page, items: page.items.map(toComplaintDto) }, 'OK');
  });

export const makeCounts = (uc: CountComplaintsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req)), 'OK');
  });

export const makeGet = (uc: GetComplaintUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toComplaintDto(await uc.execute(actorOf(req), id(req))), 'OK');
  });

type Change = {
  execute(actor: Viewer, id: string, body: never): Promise<Parameters<typeof toComplaintDto>[0]>;
};
const change = (uc: Change, message: string): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toComplaintDto(await uc.execute(actorOf(req), id(req), req.body as never)),
      message,
    );
  });

export const makeAssign = (uc: AssignComplaintUseCase): RequestHandler =>
  change(uc as Change, 'Complaint assigned.');
export const makeResolve = (uc: ResolveComplaintUseCase): RequestHandler =>
  change(uc as Change, 'Complaint resolved.');
export const makeReopen = (uc: ReopenComplaintUseCase): RequestHandler =>
  change(uc as Change, 'Complaint reopened.');
export const makeClose = (uc: CloseComplaintUseCase): RequestHandler =>
  change(uc as Change, 'Complaint closed.');

export const makeAddComment = (uc: AddComplaintCommentUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toComplaintDto(await uc.execute(actorOf(req), id(req), req.body)),
      'Message sent.',
    );
  });

export const makeDeleteComment = (uc: DeleteComplaintCommentUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toComplaintDto(await uc.execute(actorOf(req), id(req), String(req.params['commentId']))),
      'Message removed.',
    );
  });
