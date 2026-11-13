import { stockLevelOf, type StockSummaryDto } from '@vastu/contracts';
import type {
  MovementInput,
  MovementOutcome,
  NewStockItem,
  StockItem,
  StockItemFilter,
  StockMovement,
} from '../../domain/stock.entity.js';
import type { StockRepositoryPort, UserDirectoryPort } from '../../domain/ports.js';
import {
  CreateStockItemUseCase,
  ListMovementsUseCase,
  ListStockItemsUseCase,
  RecordMovementUseCase,
  UpdateStockItemUseCase,
} from '../usecases/stocks.usecases.js';

/** In-memory port for use-case tests. It honours the same contract as the Mongo adapter. */
export const hex = (n: number) => n.toString(16).padStart(24, '0');
export const ID = { admin: hex(1), office: hex(2) };

export class FakeStockRepo implements StockRepositoryPort {
  items = new Map<string, StockItem>();
  movements: StockMovement[] = [];
  private seq = 100;

  async createItem(input: NewStockItem): Promise<StockItem> {
    const item: StockItem = {
      id: hex(++this.seq),
      ...input,
      quantity: 0,
      archived: false,
      updatedAt: new Date(0),
    };
    this.items.set(item.id, item);
    return { ...item };
  }
  async findItem(id: string) {
    const i = this.items.get(id);
    return i ? { ...i } : null;
  }
  async updateItem(id: string, patch: Partial<NewStockItem> & { archived?: boolean }) {
    const i = this.items.get(id);
    if (!i) return null;
    Object.assign(i, patch);
    return { ...i };
  }
  async listItems(f: StockItemFilter, page: { page: number; pageSize: number }) {
    const all = [...this.items.values()]
      .filter((i) => f.includeArchived || !i.archived)
      .filter((i) => !f.category || i.category === f.category)
      .filter((i) => !f.search || i.name.toLowerCase().includes(f.search.toLowerCase()))
      .filter((i) => !f.lowOnly || i.quantity <= i.minLevel)
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = (page.page - 1) * page.pageSize;
    return { items: all.slice(start, start + page.pageSize), total: all.length };
  }
  async summary(): Promise<StockSummaryDto> {
    const live = [...this.items.values()].filter((i) => !i.archived);
    return {
      total: live.length,
      low: live.filter((i) => stockLevelOf(i.quantity, i.minLevel) !== 'OK').length,
      out: live.filter((i) => i.quantity <= 0).length,
      categories: [...new Set(live.map((i) => i.category).filter((c): c is string => !!c))].sort(),
    };
  }
  async applyMovement(itemId: string, input: MovementInput): Promise<MovementOutcome> {
    const i = this.items.get(itemId);
    if (!i) return { ok: false, reason: 'NOT_FOUND' };
    if (i.archived) return { ok: false, reason: 'ARCHIVED' };
    let delta = input.quantity;
    if (input.type === 'OUT') {
      if (i.quantity < input.quantity)
        return { ok: false, reason: 'INSUFFICIENT', available: i.quantity };
      i.quantity -= input.quantity;
    } else if (input.type === 'IN') {
      i.quantity += input.quantity;
    } else {
      delta = input.quantity - i.quantity;
      i.quantity = input.quantity;
    }
    const movement: StockMovement = {
      id: hex(++this.seq),
      itemId,
      type: input.type,
      quantity: delta,
      balanceAfter: i.quantity,
      note: input.note,
      byId: input.byId,
      createdAt: input.at,
    };
    this.movements.push(movement);
    return { ok: true, item: { ...i }, movement };
  }
  async listMovements(itemId: string, page: { page: number; pageSize: number }) {
    const all = this.movements.filter((m) => m.itemId === itemId).reverse();
    const start = (page.page - 1) * page.pageSize;
    return { items: all.slice(start, start + page.pageSize), total: all.length };
  }
}

export class FakeDirectory implements UserDirectoryPort {
  async find(ids: string[]) {
    return ids.map((id) => ({ id, name: id === ID.admin ? 'Admin' : 'Office' }));
  }
}

export function world() {
  const repo = new FakeStockRepo();
  const now = () => new Date('2026-11-13T10:00:00Z');
  return {
    repo,
    create: new CreateStockItemUseCase(repo, now),
    update: new UpdateStockItemUseCase(repo),
    list: new ListStockItemsUseCase(repo),
    record: new RecordMovementUseCase(repo, new FakeDirectory(), now),
    movements: new ListMovementsUseCase(repo, new FakeDirectory()),
  };
}
