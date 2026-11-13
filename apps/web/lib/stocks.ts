import {
  STOCK_UNITS,
  stockLevelOf,
  type StockLevel,
  type StockMovementType,
  type StockUnit,
} from '@vastu/contracts';

export { stockLevelOf };

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  OK: 'In stock',
  LOW: 'Low',
  OUT: 'Out of stock',
};

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  IN: 'Stock in',
  OUT: 'Stock out',
  ADJUST: 'Recount',
};

export const UNIT_LABEL: Record<StockUnit, string> = {
  pcs: 'pcs',
  sheet: 'sheets',
  kg: 'kg',
  m: 'm',
  ft: 'ft',
  box: 'boxes',
  set: 'sets',
  litre: 'litres',
};

/** 12 → "12", 2.5 → "2.5", never "2.500000001". */
export const formatQty = (n: number): string => String(Math.round(n * 1000) / 1000);

/** "12 sheets". */
export const formatStock = (n: number, unit: StockUnit): string =>
  `${formatQty(n)} ${UNIT_LABEL[unit]}`;

/** What a movement did to the balance: +10, −4, or the signed difference of a recount. */
export function signedQty(type: StockMovementType, quantity: number): string {
  if (type === 'OUT') return `−${formatQty(quantity)}`;
  if (type === 'IN') return `+${formatQty(quantity)}`;
  return quantity >= 0 ? `+${formatQty(quantity)}` : `−${formatQty(Math.abs(quantity))}`;
}

export interface StockFilters {
  search: string;
  category: string | null;
  lowOnly: boolean;
  page: number;
}

export const DEFAULT_STOCK_FILTERS: StockFilters = {
  search: '',
  category: null,
  lowOnly: false,
  page: 1,
};

export function parseStockFilters(params: { get(name: string): string | null }): StockFilters {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    search: params.get('q')?.trim() ?? '',
    category: params.get('category') || null,
    lowOnly: params.get('low') === '1',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

/** `?q=…` form of the filters; defaults are left out so the plain page has a clean URL. */
export function stockFiltersToSearch(f: StockFilters): string {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.category) p.set('category', f.category);
  if (f.lowOnly) p.set('low', '1');
  if (f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Parses what a person typed in a quantity box: "", "abc", "-1" are not quantities. */
export function parseQty(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const n = Number(t);
  return n <= 1_000_000 ? n : null;
}

export const isStockUnit = (v: string): v is StockUnit =>
  (STOCK_UNITS as readonly string[]).includes(v);
