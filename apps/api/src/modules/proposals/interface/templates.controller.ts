import type { Request, RequestHandler } from 'express';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { ActorRef } from '../domain/leadsGateway.port.js';
import type {
  CreateTemplateUseCase,
  DeleteTemplateUseCase,
  DuplicateTemplateUseCase,
  GetTemplateUseCase,
  ListTemplatesUseCase,
  UpdateTemplateUseCase,
} from '../application/usecases/templates.usecase.js';

function actorOf(req: Request): ActorRef {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
}
const keyOf = (req: Request): string => String(req.params['key']);

export function makeTemplateControllers(uc: {
  list: ListTemplatesUseCase;
  get: GetTemplateUseCase;
  create: CreateTemplateUseCase;
  update: UpdateTemplateUseCase;
  remove: DeleteTemplateUseCase;
  duplicate: DuplicateTemplateUseCase;
}) {
  return {
    list: asyncHandler(async (req, res) => {
      sendSuccess(req, res, { items: await uc.list.execute() }, 'OK');
    }) as RequestHandler,
    get: asyncHandler(async (req, res) => {
      sendSuccess(req, res, await uc.get.execute(keyOf(req)), 'OK');
    }) as RequestHandler,
    create: asyncHandler(async (req, res) => {
      sendSuccess(req, res, await uc.create.execute(actorOf(req), req.body), 'Template created.', 201);
    }) as RequestHandler,
    update: asyncHandler(async (req, res) => {
      sendSuccess(
        req,
        res,
        await uc.update.execute(actorOf(req), keyOf(req), req.body),
        'Template saved.',
      );
    }) as RequestHandler,
    remove: asyncHandler(async (req, res) => {
      await uc.remove.execute(actorOf(req), keyOf(req));
      sendSuccess(req, res, {}, 'Template deleted.');
    }) as RequestHandler,
    duplicate: asyncHandler(async (req, res) => {
      const name = (req.body as { name?: string } | undefined)?.name;
      sendSuccess(
        req,
        res,
        await uc.duplicate.execute(actorOf(req), keyOf(req), name),
        'Template copied.',
        201,
      );
    }) as RequestHandler,
  };
}

export type TemplateControllers = ReturnType<typeof makeTemplateControllers>;
