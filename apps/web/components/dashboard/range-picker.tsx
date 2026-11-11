'use client';

import { useState } from 'react';
import { MAX_DASHBOARD_DAYS } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDays, businessDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: string;
  to: string;
}

export const daysIn = (r: DateRange): number =>
  Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) +
  1;

export function presets(today = businessDate()): Array<{ id: string; label: string } & DateRange> {
  return [
    { id: 'today', label: 'Today', from: today, to: today },
    { id: '7', label: '7 days', from: addDays(today, -6), to: today },
    { id: '30', label: '30 days', from: addDays(today, -29), to: today },
  ];
}

/** Keeps a hand-picked range valid: `from` not after `to`, and at most 31 days. */
export function clampRange(r: DateRange, changed: 'from' | 'to'): DateRange {
  let { from, to } = r;
  if (from > to) {
    if (changed === 'from') to = from;
    else from = to;
  }
  if (daysIn({ from, to }) > MAX_DASHBOARD_DAYS) {
    if (changed === 'from') to = addDays(from, MAX_DASHBOARD_DAYS - 1);
    else from = addDays(to, -(MAX_DASHBOARD_DAYS - 1));
  }
  return { from, to };
}

export function RangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const today = businessDate();
  const list = presets(today);
  const active = list.find((p) => p.from === value.from && p.to === value.to)?.id ?? 'custom';
  const [showCustom, setShowCustom] = useState(active === 'custom');
  const custom = showCustom || active === 'custom';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Period"
        className="bg-card shadow-card inline-flex rounded-lg border p-0.5"
      >
        {list.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={active === p.id ? 'default' : 'ghost'}
            aria-pressed={active === p.id}
            onClick={() => {
              setShowCustom(false);
              onChange({ from: p.from, to: p.to });
            }}
          >
            {p.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={active === 'custom' ? 'default' : 'ghost'}
          aria-pressed={active === 'custom'}
          onClick={() => setShowCustom(true)}
        >
          Custom
        </Button>
      </div>
      {custom && (
        <div className={cn('flex items-center gap-2')}>
          <label className="sr-only" htmlFor="range-from">
            From
          </label>
          <Input
            id="range-from"
            type="date"
            className="h-8 w-auto"
            max={today}
            value={value.from}
            onChange={(e) =>
              e.target.value && onChange(clampRange({ from: e.target.value, to: value.to }, 'from'))
            }
          />
          <span className="text-muted-foreground">to</span>
          <label className="sr-only" htmlFor="range-to">
            To
          </label>
          <Input
            id="range-to"
            type="date"
            className="h-8 w-auto"
            max={today}
            value={value.to}
            onChange={(e) =>
              e.target.value && onChange(clampRange({ from: value.from, to: e.target.value }, 'to'))
            }
          />
        </div>
      )}
    </div>
  );
}
