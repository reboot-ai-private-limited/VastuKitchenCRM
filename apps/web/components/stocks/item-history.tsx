'use client';

import type { StockItemDto } from '@vastu/contracts';
import { useState } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockMovements } from '@/lib/api/stocks';
import { formatDate, formatTime } from '@/lib/format';
import { MOVEMENT_LABEL, formatQty, formatStock, signedQty } from '@/lib/stocks';

/** The ledger of one item: every in, out and recount, newest first, with who and why. */
export function ItemHistory({ item, onClose }: { item: StockItemDto; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const q = useStockMovements(item.id, page);
  const rows = q.data?.items ?? [];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>In stock now: {formatStock(item.quantity, item.unit)}</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-4">
          {q.isPending && <Skeleton className="h-40 w-full" />}
          {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
          {q.isSuccess && rows.length === 0 && (
            <p className="text-muted-foreground py-6 text-center">Nothing recorded yet.</p>
          )}
          <ul className="divide-y">
            {rows.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium">{MOVEMENT_LABEL[m.type]}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(m.createdAt)}, {formatTime(m.createdAt)}
                    {m.by ? ` · ${m.by.name}` : ''}
                  </p>
                  {m.note && <p className="text-xs">{m.note}</p>}
                </div>
                <div className="tabular text-right">
                  <p className="font-semibold">{signedQty(m.type, m.quantity)}</p>
                  <p className="text-muted-foreground text-xs">now {formatQty(m.balanceAfter)}</p>
                </div>
              </li>
            ))}
          </ul>
          {q.data && q.data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Newer
              </Button>
              <span className="text-muted-foreground text-xs">
                Page {page} of {q.data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= q.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Older
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
