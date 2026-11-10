import type { RequestHandler } from 'express';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type {
  CreateDesignationUseCase,
  ListDesignationsUseCase,
  UpdateDesignationUseCase,
} from '../application/usecases/designations.usecase.js';

export function makeListDesignationsController(useCase: ListDesignationsUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    const includeInactive = (req.query as { includeInactive?: boolean }).includeInactive ?? false;
    sendSuccess(req, res, await useCase.execute(includeInactive), 'OK');
  });
}

export function makeCreateDesignationController(useCase: CreateDesignationUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(req, res, await useCase.execute(req.body.name), 'Designation created.', 201);
  });
}

export function makeUpdateDesignationController(useCase: UpdateDesignationUseCase): RequestHandler {
  return asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      await useCase.execute(String(req.params['id']), req.body),
      'Designation updated.',
    );
  });
}
