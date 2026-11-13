'use client';

import { STOCK_UNITS, type StockItemDto, type StockUnit } from '@vastu/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '@/lib/api/client';
import { useCreateStockItem, useUpdateStockItem } from '@/lib/api/stocks';
import { UNIT_LABEL, parseQty } from '@/lib/stocks';

/** Add an item (with an opening balance), or edit one (name, category, unit, minimum). */
export function ItemDialog({
  open,
  onOpenChange,
  item,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: StockItemDto | null;
  categories: string[];
}) {
  // Remounted by the parent per item, so the initial values below are always the right ones.
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? '');
  const [unit, setUnit] = useState<StockUnit>(item?.unit ?? 'pcs');
  const [minLevel, setMinLevel] = useState(String(item?.minLevel ?? 0));
  const [opening, setOpening] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateStockItem();
  const update = useUpdateStockItem();
  const pending = create.isPending || update.isPending;
  const min = parseQty(minLevel);
  const open0 = parseQty(opening);
  const ready = name.trim() !== '' && min !== null && (item || open0 !== null);

  function done(msg: string) {
    toast.success(msg);
    onOpenChange(false);
  }
  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

  function submit() {
    if (min === null) return;
    setError(null);
    const base = { name: name.trim(), category: category.trim() || null, unit, minLevel: min };
    if (item) {
      update.mutate(
        { id: item.id, body: base },
        { onSuccess: () => done('Item updated'), onError: fail },
      );
    } else if (open0 !== null) {
      create.mutate(
        { ...base, openingQuantity: open0 },
        { onSuccess: () => done('Item added'), onError: fail },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit item' : 'Add a stock item'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'To change how much is in stock, record stock in, out or a recount.'
              : 'Say what it is and how it is counted. You can record the amount you have now.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="si-name">Name</Label>
            <Input
              id="si-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="si-cat">Category (optional)</Label>
              <Input
                id="si-cat"
                list="si-cats"
                value={category}
                maxLength={60}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="si-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-unit">Counted in</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as StockUnit)}>
                <SelectTrigger id="si-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="si-min">Low-stock level</Label>
              <Input
                id="si-min"
                inputMode="decimal"
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                aria-invalid={min === null}
              />
              <p className="text-muted-foreground text-xs">Marked “Low” at or below this.</p>
            </div>
            {!item && (
              <div className="space-y-1.5">
                <Label htmlFor="si-open">In stock now</Label>
                <Input
                  id="si-open"
                  inputMode="decimal"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  aria-invalid={open0 === null}
                />
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || pending}>
            {pending ? 'Saving…' : item ? 'Save' : 'Add item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
