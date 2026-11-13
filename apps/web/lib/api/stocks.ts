'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateStockItemBodyDto,
  PaginatedDto,
  StockItemDto,
  StockMovementBodyDto,
  StockMovementDto,
  StockSummaryDto,
  UpdateStockItemBodyDto,
} from '@vastu/contracts';
import type { StockFilters } from '@/lib/stocks';
import { api } from './client';

export const STOCK_PAGE_SIZE = 20;

export const useStockItems = (f: StockFilters) =>
  useQuery({
    queryKey: ['stocks', 'items', f],
    queryFn: ({ signal }) =>
      api<PaginatedDto<StockItemDto>>('/stocks/items', {
        query: {
          page: f.page,
          pageSize: STOCK_PAGE_SIZE,
          search: f.search || undefined,
          category: f.category ?? undefined,
          lowOnly: f.lowOnly,
        },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

export const useStockSummary = () =>
  useQuery({
    queryKey: ['stocks', 'summary'],
    queryFn: ({ signal }) => api<StockSummaryDto>('/stocks/summary', { signal }),
  });

export const useStockMovements = (itemId: string | null, page = 1) =>
  useQuery({
    queryKey: ['stocks', 'movements', itemId, page],
    enabled: itemId !== null,
    queryFn: ({ signal }) =>
      api<PaginatedDto<StockMovementDto>>(`/stocks/items/${itemId}/movements`, {
        query: { page, pageSize: 20 },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

/** Every stock write changes the list, the totals and maybe a history: refresh them all. */
function useStockMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stocks'] }),
  });
}

export const useCreateStockItem = () =>
  useStockMutation((body: CreateStockItemBodyDto) =>
    api<StockItemDto>('/stocks/items', { method: 'POST', body }),
  );

export const useUpdateStockItem = () =>
  useStockMutation((v: { id: string; body: UpdateStockItemBodyDto }) =>
    api<StockItemDto>(`/stocks/items/${v.id}`, { method: 'PATCH', body: v.body }),
  );

export const useRecordMovement = () =>
  useStockMutation((v: { id: string; body: StockMovementBodyDto }) =>
    api<{ item: StockItemDto; movement: StockMovementDto }>(`/stocks/items/${v.id}/movements`, {
      method: 'POST',
      body: v.body,
    }),
  );
