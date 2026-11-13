import { describe, expect, it } from 'vitest';
import {
  formatQty,
  formatStock,
  parseQty,
  parseStockFilters,
  signedQty,
  stockFiltersToSearch,
  stockLevelOf,
} from './stocks';

describe('stock level', () => {
  it('is OUT at zero, LOW at or under the minimum, otherwise OK', () => {
    expect(stockLevelOf(0, 5)).toBe('OUT');
    expect(stockLevelOf(5, 5)).toBe('LOW');
    expect(stockLevelOf(6, 5)).toBe('OK');
    expect(stockLevelOf(1, 0)).toBe('OK');
  });
});

describe('quantities', () => {
  it('formats without float noise and with the unit', () => {
    expect(formatQty(0.1 + 0.2)).toBe('0.3');
    expect(formatStock(12, 'sheet')).toBe('12 sheets');
  });
  it('shows what a movement did to the balance', () => {
    expect(signedQty('IN', 10)).toBe('+10');
    expect(signedQty('OUT', 4)).toBe('−4');
    expect(signedQty('ADJUST', -3)).toBe('−3');
    expect(signedQty('ADJUST', 2)).toBe('+2');
  });
  it('accepts only plain non-negative numbers', () => {
    expect(parseQty(' 12 ')).toBe(12);
    expect(parseQty('2.5')).toBe(2.5);
    for (const bad of ['', 'abc', '-1', '1e3', '1.2345', '2000000'])
      expect(parseQty(bad)).toBeNull();
  });
});

describe('filters in the URL', () => {
  it('round-trips, and leaves defaults out', () => {
    const f = parseStockFilters(new URLSearchParams('q=ply&category=Boards&low=1&page=2'));
    expect(f).toEqual({ search: 'ply', category: 'Boards', lowOnly: true, page: 2 });
    expect(stockFiltersToSearch(f)).toBe('?q=ply&category=Boards&low=1&page=2');
    expect(stockFiltersToSearch(parseStockFilters(new URLSearchParams('page=0')))).toBe('');
  });
});
