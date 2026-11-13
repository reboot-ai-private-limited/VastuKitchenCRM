import type { StockSummaryDto } from '@vastu/contracts';
import type {
  MovementInput,
  MovementOutcome,
  NewStockItem,
  StockItem,
  StockItemFilter,
  StockMovement,
} from './stock.entity.js';

export interface StockRepositoryPort {
  createItem(input: NewStockItem): Promise<StockItem>;
  findItem(id: string): Promise<StockItem | null>;
  updateItem(
    id: string,
    patch: Partial<NewStockItem> & { archived?: boolean },
  ): Promise<StockItem | null>;
  listItems(
    filter: StockItemFilter,
    page: { page: number; pageSize: number },
  ): Promise<{ items: StockItem[]; total: number }>;
  summary(): Promise<StockSummaryDto>;
  /** Atomic: the balance change and the movement line succeed or fail together. */
  applyMovement(itemId: string, input: MovementInput): Promise<MovementOutcome>;
  listMovements(
    itemId: string,
    page: { page: number; pageSize: number },
  ): Promise<{ items: StockMovement[]; total: number }>;
}

export interface DirectoryUser {
  id: string;
  name: string;
}
export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
}
