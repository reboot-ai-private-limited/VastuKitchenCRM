'use client';

import { LEAD_PRODUCTS_OF_INTEREST, type LeadProductOfInterest } from '@vastu/contracts';
import { Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PRODUCT_OF_INTEREST_LABEL } from '@/lib/leads';
import { cn } from '@/lib/utils';

export function ProductInterestPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: LeadProductOfInterest[];
  onChange: (next: LeadProductOfInterest[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function toggle(item: LeadProductOfInterest) {
    if (value.includes(item)) onChange(value.filter((v) => v !== item));
    else onChange([...value, item]);
  }

  const summary =
    value.length === 0
      ? null
      : value.length <= 2
        ? value.map((v) => PRODUCT_OF_INTEREST_LABEL[v]).join(', ')
        : `${PRODUCT_OF_INTEREST_LABEL[value[0]!]} +${value.length - 1} more`;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cn(
              'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
              !summary && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{summary ?? 'Select products of interest'}</span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) gap-0 p-1">
          <div role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto">
            {LEAD_PRODUCTS_OF_INTEREST.map((item) => {
              const selected = value.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggle(item)}
                  className={cn(
                    'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors outline-none',
                    selected && 'bg-accent/50 font-medium',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                      selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background',
                    )}
                    aria-hidden
                  >
                    {selected && <Check className="size-3 stroke-[3]" />}
                  </span>
                  <span className="truncate">{PRODUCT_OF_INTEREST_LABEL[item]}</span>
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <div className="mt-1 flex items-center justify-between border-t px-2 pt-1.5 pb-0.5 text-xs">
              <span className="text-muted-foreground">{value.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-muted-foreground hover:text-foreground underline"
              >
                Clear all
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <span
              key={item}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-xs font-medium"
            >
              {PRODUCT_OF_INTEREST_LABEL[item]}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${PRODUCT_OF_INTEREST_LABEL[item]}`}
                onClick={() => toggle(item)}
                className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
