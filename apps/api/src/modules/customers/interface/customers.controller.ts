import type { Request, RequestHandler } from 'express';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { Actor } from '../domain/ports.js';
import type {
  AddCustomerUseCase,
  GetCustomerUseCase,
  ImportCustomersUseCase,
  ListCustomersUseCase,
  StartNewProjectForCustomerUseCase,
} from '../application/usecases/customers.usecases.js';
import { toCustomerDto } from './customers.mapper.js';

const actorOf = (req: Request): Actor => {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub, role: req.user.role };
};
const customerId = (req: Request) => String(req.params['customerId']);

export const makeList = (uc: ListCustomersUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number; search?: string };
    const { items, total } = await uc.execute(actorOf(req), q);
    sendSuccess(
      req,
      res,
      {
        items: items.map(toCustomerDto),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      },
      'OK',
    );
  });

export const makeGet = (uc: GetCustomerUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toCustomerDto(await uc.execute(actorOf(req), customerId(req))), 'OK');
  });

export const makeAdd = (uc: AddCustomerUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toCustomerDto(await uc.execute(actorOf(req), req.body)),
      'Customer added.',
      201,
    );
  });

export const makeImport = (uc: ImportCustomersUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute(actorOf(req), req.body), 'Import finished.');
  });

export const makeStartNewProject = (uc: StartNewProjectForCustomerUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(
      req,
      res,
      toCustomerDto(await uc.execute(actorOf(req), customerId(req))),
      'New project started.',
    );
  });
