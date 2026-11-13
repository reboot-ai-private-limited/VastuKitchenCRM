import type { Request, RequestHandler } from 'express';
import type { ListStockItemsQueryDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import { asyncHandler } from '@/shared/http/asyncHandler.js';
import { sendSuccess } from '@/shared/http/response.util.js';
import type { Viewer } from '../domain/stock.entity.js';
import type {
  CreateStockItemUseCase,
  ListMovementsUseCase,
  ListStockItemsUseCase,
  RecordMovementUseCase,
  StockSummaryUseCase,
  UpdateStockItemUseCase,
} from '../application/usecases/stocks.usecases.js';
import { toItemDto, toMovementDto } from './stocks.mapper.js';

function actorOf(req: Request): Viewer {
  if (!req.user) throw AppError.unauthenticated();
  return { id: req.user.sub };
}
const itemId = (req: Request): string => String(req.params['itemId']);
const pageOf = (q: { page: number; pageSize: number }, total: number) => ({
  page: q.page,
  pageSize: q.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
});

export const makeCreate = (uc: CreateStockItemUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toItemDto(await uc.execute(actorOf(req), req.body)), 'Item added.', 201);
  });

export const makeUpdate = (uc: UpdateStockItemUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, toItemDto(await uc.execute(itemId(req), req.body)), 'Item updated.');
  });

export const makeList = (uc: ListStockItemsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as ListStockItemsQueryDto;
    const { items, total } = await uc.execute(q);
    sendSuccess(req, res, { items: items.map(toItemDto), ...pageOf(q, total) });
  });

export const makeSummary = (uc: StockSummaryUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    sendSuccess(req, res, await uc.execute());
  });

export const makeRecord = (uc: RecordMovementUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const { item, view } = await uc.execute(actorOf(req), itemId(req), req.body);
    sendSuccess(
      req,
      res,
      { item: toItemDto(item), movement: toMovementDto(view) },
      'Stock recorded.',
      201,
    );
  });

export const makeMovements = (uc: ListMovementsUseCase): RequestHandler =>
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const { items, total } = await uc.execute(itemId(req), q);
    sendSuccess(req, res, { items: items.map(toMovementDto), ...pageOf(q, total) });
  });
