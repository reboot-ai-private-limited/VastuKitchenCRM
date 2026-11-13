import { Router, type RequestHandler } from 'express';
import type { z } from 'zod';
import {
  createStockItemBodySchema,
  listStockItemsQuerySchema,
  paginationQuerySchema,
  stockItemParamsSchema,
  stockItemSchema,
  stockItemsPageSchema,
  stockMovementBodySchema,
  stockMovementSchema,
  stockMovementsPageSchema,
  stockSummarySchema,
  updateStockItemBodySchema,
} from '@vastu/contracts';
import { authenticate } from '@/shared/http/authenticate.middleware.js';
import { requireRole } from '@/shared/http/authorize.middleware.js';
import { errorResponse, okResponse, openApiRegistry } from '@/shared/http/swagger.util.js';
import { validate } from '@/shared/http/validate.middleware.js';

const security = [{ bearerAuth: [] }];
const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });
const forbidden = errorResponse('Only Admin and Office');
const notFound = errorResponse('Not found');

const doc = (
  method: 'get' | 'post' | 'patch',
  path: string,
  summary: string,
  request: Record<string, unknown> | undefined,
  responses: Record<string | number, unknown>,
) =>
  openApiRegistry.registerPath({
    method,
    path,
    tags: ['Stocks'],
    security,
    summary,
    ...(request ? { request } : {}),
    responses,
  } as never);

doc(
  'get',
  '/api/stocks/items',
  'List stock items',
  { query: listStockItemsQuerySchema },
  {
    200: okResponse('A page of items', stockItemsPageSchema),
    403: forbidden,
  },
);
doc(
  'post',
  '/api/stocks/items',
  'Add a stock item (with an optional opening balance)',
  {
    body: json(createStockItemBodySchema),
  },
  { 201: okResponse('The item', stockItemSchema), 403: forbidden },
);
doc(
  'patch',
  '/api/stocks/items/{itemId}',
  'Edit, archive or restore an item',
  {
    params: stockItemParamsSchema,
    body: json(updateStockItemBodySchema),
  },
  { 200: okResponse('The item', stockItemSchema), 403: forbidden, 404: notFound },
);
doc(
  'post',
  '/api/stocks/items/{itemId}/movements',
  'Record stock in, out or a recount',
  {
    params: stockItemParamsSchema,
    body: json(stockMovementBodySchema),
  },
  {
    201: okResponse('The movement', stockMovementSchema),
    403: forbidden,
    404: notFound,
    409: errorResponse('Not enough stock, or the item is archived'),
  },
);
doc(
  'get',
  '/api/stocks/items/{itemId}/movements',
  'Movement history of one item',
  {
    params: stockItemParamsSchema,
    query: paginationQuerySchema,
  },
  {
    200: okResponse('A page of movements', stockMovementsPageSchema),
    403: forbidden,
    404: notFound,
  },
);
doc('get', '/api/stocks/summary', 'Totals: items, low, out, categories', undefined, {
  200: okResponse('Summary', stockSummarySchema),
  403: forbidden,
});

export interface StocksControllers {
  list: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  record: RequestHandler;
  movements: RequestHandler;
  summary: RequestHandler;
}

export function buildStocksRouter(c: StocksControllers): Router {
  const router = Router();
  // Stock is Admin/Office only, for every route of the module.
  router.use(authenticate, requireRole('ADMIN', 'OFFICE'));
  const p = validate({ params: stockItemParamsSchema });

  router.get('/summary', c.summary);
  router.get('/items', validate({ query: listStockItemsQuerySchema }), c.list);
  router.post('/items', validate({ body: createStockItemBodySchema }), c.create);
  router.patch(
    '/items/:itemId',
    validate({ params: stockItemParamsSchema, body: updateStockItemBodySchema }),
    c.update,
  );
  router.post(
    '/items/:itemId/movements',
    validate({ params: stockItemParamsSchema, body: stockMovementBodySchema }),
    c.record,
  );
  router.get(
    '/items/:itemId/movements',
    p,
    validate({ query: paginationQuerySchema }),
    c.movements,
  );
  return router;
}
