'use client';

import type { StockItemDto, StockMovementType } from '@vastu/contracts';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  History,
  Pencil,
  Plus,
  Search,
  Archive,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { StatCard } from '@/components/common/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStockItems, useStockSummary, useUpdateStockItem } from '@/lib/api/stocks';
import {
  formatStock,
  parseStockFilters,
  stockFiltersToSearch,
  type StockFilters,
} from '@/lib/stocks';
import { ItemDialog } from './item-dialog';
import { ItemHistory } from './item-history';
import { MovementDialog } from './movement-dialog';
import { StockLevelBadge } from './stock-level-badge';

const ALL = '__all__';

export function StocksView() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useMemo(() => parseStockFilters(params), [params]);
  const [typed, setTyped] = useState(filters.search);
  const [editing, setEditing] = useState<StockItemDto | 'new' | null>(null);
  const [moving, setMoving] = useState<{ item: StockItemDto; type: StockMovementType } | null>(
    null,
  );
  const [history, setHistory] = useState<StockItemDto | null>(null);
  const items = useStockItems(filters);
  const summary = useStockSummary();
  const update = useUpdateStockItem();
  const categories = summary.data?.categories ?? [];
  const rows = items.data?.items ?? [];

  const go = (patch: Partial<StockFilters>) =>
    router.replace(`/stocks${stockFiltersToSearch({ ...filters, page: 1, ...patch })}`, {
      scroll: false,
    });

  // Search as you type, but only hit the server (and the URL) once typing pauses.
  useEffect(() => {
    if (typed.trim() === filters.search) return;
    const t = setTimeout(() => go({ search: typed.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  const narrowed = filters.search !== '' || filters.category !== null || filters.lowOnly;

  return (
    <PageBody>
      <PageHeader
        title="Stocks"
        description="What is in stock, what came in, what went out."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Add item
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Items" value={summary.data?.total ?? 0} loading={summary.isPending} />
        <StatCard
          label="Low"
          value={summary.data?.low ?? 0}
          loading={summary.isPending}
          sub={filters.lowOnly ? 'Showing these' : 'At or under their level'}
          href={filters.lowOnly ? undefined : '/stocks?low=1'}
        />
        <StatCard label="Out of stock" value={summary.data?.out ?? 0} loading={summary.isPending} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" aria-hidden />
          <Input
            aria-label="Search items"
            placeholder="Search items"
            className="pl-8"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <Select
            value={filters.category ?? ALL}
            onValueChange={(v) => go({ category: v === ALL ? null : v })}
          >
            <SelectTrigger aria-label="Category" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={filters.lowOnly ? 'default' : 'outline'}
          aria-pressed={filters.lowOnly}
          onClick={() => go({ lowOnly: !filters.lowOnly })}
        >
          Low only
        </Button>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        {items.isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : items.isError ? (
          <ErrorState error={items.error} onRetry={() => items.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={narrowed ? 'Nothing matches' : 'No items yet'}
            description={
              narrowed
                ? 'Try a different search or clear the filters.'
                : 'Add the materials you keep in stock, then record what comes in and goes out.'
            }
            action={
              narrowed ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTyped('');
                    go({ search: '', category: null, lowOnly: false });
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setEditing('new')}>
                  <Plus /> Add item
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <p className="font-medium">{i.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {i.category ?? 'No category'}
                      <span className="sm:hidden"> · </span>
                    </p>
                    <span className="sm:hidden">
                      <StockLevelBadge level={i.level} />
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">
                    {formatStock(i.quantity, i.unit)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StockLevelBadge level={i.level} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMoving({ item: i, type: 'IN' })}
                      >
                        <ArrowDownToLine /> In
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={i.quantity <= 0}
                        onClick={() => setMoving({ item: i, type: 'OUT' })}
                      >
                        <ArrowUpFromLine /> Out
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setMoving({ item: i, type: 'ADJUST' })}
                      >
                        Recount
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`History of ${i.name}`}
                        onClick={() => setHistory(i)}
                      >
                        <History />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${i.name}`}
                        onClick={() => setEditing(i)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Archive ${i.name}`}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: i.id, body: { archived: true } })}
                      >
                        <Archive />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {items.data && items.data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => go({ page: filters.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-xs">
            Page {filters.page} of {items.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= items.data.totalPages}
            onClick={() => go({ page: filters.page + 1 })}
          >
            Next
          </Button>
        </div>
      )}

      {editing && (
        <ItemDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          item={editing === 'new' ? null : editing}
          categories={categories}
        />
      )}
      {moving && (
        <MovementDialog
          key={`${moving.item.id}:${moving.type}`}
          item={moving.item}
          type={moving.type}
          onClose={() => setMoving(null)}
        />
      )}
      {history && <ItemHistory item={history} onClose={() => setHistory(null)} />}
    </PageBody>
  );
}
