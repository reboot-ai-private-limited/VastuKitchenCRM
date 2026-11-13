import type { StockMovementType, StockUnit } from '@vastu/contracts';

export interface Viewer {
  id: string;
}

export interface StockItem {
  id: string;
  name: string;
  category: string | null;
  unit: StockUnit;
  quantity: number;
  minLevel: number;
  archived: boolean;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  /** Positive for IN / OUT; signed difference for ADJUST. */
  quantity: number;
  balanceAfter: number;
  note: string | null;
  byId: string | null;
  createdAt: Date;
}

export interface NewStockItem {
  name: string;
  category: string | null;
  unit: StockUnit;
  minLevel: number;
}

export interface StockItemFilter {
  search?: string | undefined;
  category?: string | undefined;
  lowOnly: boolean;
  includeArchived: boolean;
}

export interface MovementInput {
  type: StockMovementType;
  /** IN / OUT: amount moved. ADJUST: the new counted total. */
  quantity: number;
  note: string | null;
  byId: string;
  at: Date;
}

/** Why a movement was refused, so the use case can pick the right error. */
export type MovementOutcome =
  | { ok: true; item: StockItem; movement: StockMovement }
  | { ok: false; reason: 'NOT_FOUND' | 'ARCHIVED' | 'INSUFFICIENT'; available?: number };
