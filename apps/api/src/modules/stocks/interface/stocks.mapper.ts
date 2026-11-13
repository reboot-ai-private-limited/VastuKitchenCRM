import { stockLevelOf, type StockItemDto, type StockMovementDto } from '@vastu/contracts';
import type { StockItem } from '../domain/stock.entity.js';
import type { MovementView } from '../application/usecases/stocks.usecases.js';

export const toItemDto = (i: StockItem): StockItemDto => ({
  id: i.id,
  name: i.name,
  category: i.category,
  unit: i.unit,
  quantity: i.quantity,
  minLevel: i.minLevel,
  level: stockLevelOf(i.quantity, i.minLevel),
  archived: i.archived,
  updatedAt: i.updatedAt.toISOString(),
});

export const toMovementDto = ({ movement: m, by }: MovementView): StockMovementDto => ({
  id: m.id,
  itemId: m.itemId,
  type: m.type,
  quantity: m.quantity,
  balanceAfter: m.balanceAfter,
  note: m.note,
  by,
  createdAt: m.createdAt.toISOString(),
});
