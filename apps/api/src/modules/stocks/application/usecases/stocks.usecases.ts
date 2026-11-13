import type {
  CreateStockItemBodyDto,
  ListStockItemsQueryDto,
  StockMovementBodyDto,
  StockSummaryDto,
  UpdateStockItemBodyDto,
} from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import type { StockItem, StockMovement, Viewer } from '../../domain/stock.entity.js';
import type { StockRepositoryPort, UserDirectoryPort } from '../../domain/ports.js';

export interface MovementView {
  movement: StockMovement;
  by: { id: string; name: string } | null;
}

async function withNames(
  rows: StockMovement[],
  directory: UserDirectoryPort,
): Promise<MovementView[]> {
  const ids = [...new Set(rows.map((r) => r.byId).filter((x): x is string => !!x))];
  const names = new Map((await directory.find(ids)).map((u) => [u.id, u.name]));
  return rows.map((movement) => ({
    movement,
    by: movement.byId ? { id: movement.byId, name: names.get(movement.byId) ?? 'Staff' } : null,
  }));
}

const requireItem = async (repo: StockRepositoryPort, id: string): Promise<StockItem> => {
  const item = await repo.findItem(id);
  if (!item) throw AppError.notFound('Stock item not found.');
  return item;
};

export class CreateStockItemUseCase {
  constructor(
    private readonly repo: StockRepositoryPort,
    private readonly now: () => Date,
  ) {}

  async execute(actor: Viewer, body: CreateStockItemBodyDto): Promise<StockItem> {
    const item = await this.repo.createItem({
      name: body.name,
      category: body.category ?? null,
      unit: body.unit,
      minLevel: body.minLevel,
    });
    if (body.openingQuantity <= 0) return item;
    const out = await this.repo.applyMovement(item.id, {
      type: 'IN',
      quantity: body.openingQuantity,
      note: 'Opening balance',
      byId: actor.id,
      at: this.now(),
    });
    return out.ok ? out.item : item;
  }
}

export class UpdateStockItemUseCase {
  constructor(private readonly repo: StockRepositoryPort) {}

  async execute(id: string, body: UpdateStockItemBodyDto): Promise<StockItem> {
    const patch: Parameters<StockRepositoryPort['updateItem']>[1] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.category !== undefined) patch.category = body.category;
    if (body.unit !== undefined) patch.unit = body.unit;
    if (body.minLevel !== undefined) patch.minLevel = body.minLevel;
    if (body.archived !== undefined) patch.archived = body.archived;
    const item = await this.repo.updateItem(id, patch);
    if (!item) throw AppError.notFound('Stock item not found.');
    return item;
  }
}

export class ListStockItemsUseCase {
  constructor(private readonly repo: StockRepositoryPort) {}

  execute(q: ListStockItemsQueryDto) {
    return this.repo.listItems(
      {
        search: q.search,
        category: q.category,
        lowOnly: q.lowOnly,
        includeArchived: q.includeArchived,
      },
      { page: q.page, pageSize: q.pageSize },
    );
  }
}

export class StockSummaryUseCase {
  constructor(private readonly repo: StockRepositoryPort) {}
  execute(): Promise<StockSummaryDto> {
    return this.repo.summary();
  }
}

export class RecordMovementUseCase {
  constructor(
    private readonly repo: StockRepositoryPort,
    private readonly directory: UserDirectoryPort,
    private readonly now: () => Date,
  ) {}

  async execute(
    actor: Viewer,
    itemId: string,
    body: StockMovementBodyDto,
  ): Promise<{ item: StockItem; view: MovementView }> {
    if (body.type !== 'ADJUST' && body.quantity <= 0)
      throw AppError.badRequest('Quantity must be more than zero.');
    const out = await this.repo.applyMovement(itemId, {
      type: body.type,
      quantity: body.quantity,
      note: body.note ?? null,
      byId: actor.id,
      at: this.now(),
    });
    if (!out.ok) {
      if (out.reason === 'NOT_FOUND') throw AppError.notFound('Stock item not found.');
      if (out.reason === 'ARCHIVED')
        throw AppError.conflict('This item is archived. Restore it before recording stock.');
      throw AppError.conflict(`Only ${out.available ?? 0} in stock, so that much cannot go out.`, {
        available: out.available ?? 0,
      });
    }
    const [view] = await withNames([out.movement], this.directory);
    return { item: out.item, view: view as MovementView };
  }
}

export class ListMovementsUseCase {
  constructor(
    private readonly repo: StockRepositoryPort,
    private readonly directory: UserDirectoryPort,
  ) {}

  async execute(itemId: string, page: { page: number; pageSize: number }) {
    await requireItem(this.repo, itemId);
    const { items, total } = await this.repo.listMovements(itemId, page);
    return { items: await withNames(items, this.directory), total };
  }
}
