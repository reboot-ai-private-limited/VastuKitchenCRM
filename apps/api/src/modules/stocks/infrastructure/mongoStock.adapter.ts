import { Types, type FilterQuery, type HydratedDocument } from 'mongoose';
import type { StockSummaryDto } from '@vastu/contracts';
import { escapeRegex } from '@/shared/db/mongoErrors.js';
import type {
  MovementInput,
  MovementOutcome,
  NewStockItem,
  StockItem,
  StockItemFilter,
  StockMovement,
} from '../domain/stock.entity.js';
import type { StockRepositoryPort } from '../domain/ports.js';
import {
  StockItemModel,
  StockMovementModel,
  type StockItemDoc,
  type StockMovementDoc,
} from './stock.schemas.js';

const oid = (v: string) => new Types.ObjectId(v);

export const toItem = (d: HydratedDocument<StockItemDoc>): StockItem => ({
  id: d.id as string,
  name: d.name,
  category: d.category,
  unit: d.unit,
  quantity: d.quantity,
  minLevel: d.minLevel,
  archived: d.archived,
  updatedAt: d.updatedAt,
});

const toMovement = (d: HydratedDocument<StockMovementDoc>): StockMovement => ({
  id: d.id as string,
  itemId: d.itemId.toString(),
  type: d.type,
  quantity: d.quantity,
  balanceAfter: d.balanceAfter,
  note: d.note,
  byId: d.byId ? d.byId.toString() : null,
  createdAt: d.createdAt,
});

function toQuery(f: StockItemFilter): FilterQuery<StockItemDoc> {
  const q: FilterQuery<StockItemDoc> = {};
  if (!f.includeArchived) q.archived = false;
  if (f.category) q.category = f.category;
  if (f.search) q.name = { $regex: escapeRegex(f.search), $options: 'i' };
  if (f.lowOnly) q.$expr = { $lte: ['$quantity', '$minLevel'] };
  return q;
}

export class MongoStockRepository implements StockRepositoryPort {
  async createItem(input: NewStockItem): Promise<StockItem> {
    return toItem(await StockItemModel.create({ ...input, quantity: 0 }));
  }

  async findItem(id: string): Promise<StockItem | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const d = await StockItemModel.findById(id);
    return d ? toItem(d) : null;
  }

  async updateItem(
    id: string,
    patch: Partial<NewStockItem> & { archived?: boolean },
  ): Promise<StockItem | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const d = await StockItemModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
    return d ? toItem(d) : null;
  }

  async listItems(filter: StockItemFilter, page: { page: number; pageSize: number }) {
    const q = toQuery(filter);
    const [docs, total] = await Promise.all([
      StockItemModel.find(q)
        .sort({ name: 1, _id: 1 })
        .skip((page.page - 1) * page.pageSize)
        .limit(page.pageSize),
      StockItemModel.countDocuments(q),
    ]);
    return { items: docs.map(toItem), total };
  }

  async summary(): Promise<StockSummaryDto> {
    const live = { archived: false };
    const [total, low, out, categories] = await Promise.all([
      StockItemModel.countDocuments(live),
      StockItemModel.countDocuments({ ...live, $expr: { $lte: ['$quantity', '$minLevel'] } }),
      StockItemModel.countDocuments({ ...live, quantity: { $lte: 0 } }),
      StockItemModel.distinct('category', { ...live, category: { $ne: null } }),
    ]);
    return { total, low, out, categories: (categories as string[]).sort() };
  }

  async applyMovement(itemId: string, input: MovementInput): Promise<MovementOutcome> {
    if (!Types.ObjectId.isValid(itemId)) return { ok: false, reason: 'NOT_FOUND' };
    const _id = oid(itemId);
    // One atomic update on the item decides the new balance, so two people acting at once
    // can never push it below zero or lose a count.
    let after: HydratedDocument<StockItemDoc> | null;
    let delta = input.quantity;
    if (input.type === 'IN') {
      after = await StockItemModel.findOneAndUpdate(
        { _id, archived: false },
        { $inc: { quantity: input.quantity } },
        { new: true },
      );
    } else if (input.type === 'OUT') {
      after = await StockItemModel.findOneAndUpdate(
        { _id, archived: false, quantity: { $gte: input.quantity } },
        { $inc: { quantity: -input.quantity } },
        { new: true },
      );
    } else {
      const before = await StockItemModel.findOneAndUpdate(
        { _id, archived: false },
        [{ $set: { quantity: input.quantity } }],
        { new: false },
      );
      if (before) delta = input.quantity - before.quantity;
      after = before ? await StockItemModel.findById(_id) : null;
    }
    if (!after) {
      const cur = await StockItemModel.findById(_id);
      if (!cur) return { ok: false, reason: 'NOT_FOUND' };
      if (cur.archived) return { ok: false, reason: 'ARCHIVED' };
      return { ok: false, reason: 'INSUFFICIENT', available: cur.quantity };
    }
    const line = await StockMovementModel.create({
      itemId: _id,
      type: input.type,
      quantity: delta,
      balanceAfter: after.quantity,
      note: input.note,
      byId: oid(input.byId),
      createdAt: input.at,
    });
    return { ok: true, item: toItem(after), movement: toMovement(line) };
  }

  async listMovements(itemId: string, page: { page: number; pageSize: number }) {
    const q = { itemId: oid(itemId) };
    const [docs, total] = await Promise.all([
      StockMovementModel.find(q)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page.page - 1) * page.pageSize)
        .limit(page.pageSize),
      StockMovementModel.countDocuments(q),
    ]);
    return { items: docs.map(toMovement), total };
  }
}
