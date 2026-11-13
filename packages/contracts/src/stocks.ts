import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from './pagination.js';

/** Units an item is counted in. Kept short on purpose: this is a ledger, not a catalogue. */
export const STOCK_UNITS = ['pcs', 'sheet', 'kg', 'm', 'ft', 'box', 'set', 'litre'] as const;
export const stockUnitSchema = z.enum(STOCK_UNITS);
export type StockUnit = z.infer<typeof stockUnitSchema>;

/** IN = received, OUT = used or issued, ADJUST = a recount (the signed difference is stored). */
export const STOCK_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUST'] as const;
export const stockMovementTypeSchema = z.enum(STOCK_MOVEMENT_TYPES);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

/** OK above the minimum level, LOW at or below it, OUT at zero. */
export type StockLevel = 'OK' | 'LOW' | 'OUT';

const qty = z.number().finite().min(0).max(1_000_000);

export const stockItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  unit: stockUnitSchema,
  quantity: z.number(),
  minLevel: z.number(),
  level: z.enum(['OK', 'LOW', 'OUT']),
  archived: z.boolean(),
  updatedAt: z.string(),
});
export type StockItemDto = z.infer<typeof stockItemSchema>;

export const stockMovementSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  type: stockMovementTypeSchema,
  /** Positive for IN and OUT. For ADJUST the signed difference (new count minus old). */
  quantity: z.number(),
  balanceAfter: z.number(),
  note: z.string().nullable(),
  by: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});
export type StockMovementDto = z.infer<typeof stockMovementSchema>;

export const createStockItemBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z
    .string()
    .trim()
    .max(60)
    .nullish()
    .transform((v) => v || null),
  unit: stockUnitSchema,
  minLevel: qty.default(0),
  /** Opening balance. Recorded as the first movement when above zero. */
  openingQuantity: qty.default(0),
});
export type CreateStockItemBodyDto = z.infer<typeof createStockItemBodySchema>;

export const updateStockItemBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().max(60).nullable(),
    unit: stockUnitSchema,
    minLevel: qty,
    archived: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
export type UpdateStockItemBodyDto = z.infer<typeof updateStockItemBodySchema>;

/** IN / OUT: `quantity` is the amount moved. ADJUST: `quantity` is the new counted total. */
export const stockMovementBodySchema = z.object({
  type: stockMovementTypeSchema,
  quantity: qty,
  note: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => v || null),
});
export type StockMovementBodyDto = z.infer<typeof stockMovementBodySchema>;

export const listStockItemsQuerySchema = paginationQuerySchema.extend({
  category: z.string().trim().min(1).optional(),
  /** Only items at or below their minimum level. */
  lowOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type ListStockItemsQueryDto = z.infer<typeof listStockItemsQuerySchema>;

export const stockItemsPageSchema = paginatedSchema(stockItemSchema);
export const stockMovementsPageSchema = paginatedSchema(stockMovementSchema);
export const stockItemParamsSchema = z.object({ itemId: z.string().regex(/^[a-f\d]{24}$/i) });

export const stockSummarySchema = z.object({
  total: z.number().int(),
  low: z.number().int(),
  out: z.number().int(),
  categories: z.array(z.string()),
});
export type StockSummaryDto = z.infer<typeof stockSummarySchema>;

export const stockLevelOf = (quantity: number, minLevel: number): StockLevel =>
  quantity <= 0 ? 'OUT' : quantity <= minLevel ? 'LOW' : 'OK';
