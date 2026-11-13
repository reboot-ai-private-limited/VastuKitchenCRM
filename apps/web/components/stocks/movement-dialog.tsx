'use client';

import type { StockItemDto, StockMovementType } from '@vastu/contracts';
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
import { ApiError } from '@/lib/api/client';
import { useRecordMovement } from '@/lib/api/stocks';
import { MOVEMENT_LABEL, formatStock, parseQty } from '@/lib/stocks';

const HELP: Record<StockMovementType, { field: string; done: string }> = {
  IN: { field: 'How much came in?', done: 'Stock added' },
  OUT: { field: 'How much went out?', done: 'Stock removed' },
  ADJUST: { field: 'What is the counted total?', done: 'Count saved' },
};

/** One dialog for the three things you can do to a balance. Remounted per item and type. */
export function MovementDialog({
  item,
  type,
  onClose,
}: {
  item: StockItemDto;
  type: StockMovementType;
  onClose: () => void;
}) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const record = useRecordMovement();
  const n = parseQty(qty);
  const tooMuch = type === 'OUT' && n !== null && n > item.quantity;
  const ready = n !== null && (type === 'ADJUST' || n > 0) && !tooMuch;

  function submit() {
    if (n === null) return;
    setError(null);
    record.mutate(
      { id: item.id, body: { type, quantity: n, note: note.trim() || null } },
      {
        onSuccess: () => {
          toast.success(HELP[type].done);
          onClose();
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !record.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {MOVEMENT_LABEL[type]}: {item.name}
          </DialogTitle>
          <DialogDescription>
            In stock now: {formatStock(item.quantity, item.unit)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mv-qty">
              {HELP[type].field} ({item.unit})
            </Label>
            <Input
              id="mv-qty"
              inputMode="decimal"
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-invalid={tooMuch}
            />
            {tooMuch && (
              <p className="text-danger text-xs">
                Only {formatStock(item.quantity, item.unit)} in stock.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-note">Note (optional)</Label>
            <Input
              id="mv-note"
              value={note}
              maxLength={300}
              placeholder={type === 'OUT' ? 'e.g. Rao kitchen, site 2' : ''}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={record.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!ready || record.isPending}>
            {record.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
