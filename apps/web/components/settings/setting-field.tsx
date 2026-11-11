'use client';

import type { SettingDto } from '@vastu/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { approxDuration, formatDefault, parseDraft, unitOf } from '@/lib/settings';
import { cn } from '@/lib/utils';

/** One setting, rendered by its type: switch, number (with unit and limits), text or long text. */
export function SettingField({
  setting: s,
  value,
  error,
  edited,
  resetting,
  onChange,
  onReset,
}: {
  setting: SettingDto;
  value: string | boolean;
  error?: string;
  /** Typed into but not saved yet. */
  edited: boolean;
  resetting: boolean;
  onChange: (v: string | boolean) => void;
  onReset: () => void;
}) {
  const id = `setting-${s.key}`;
  const unit = unitOf(s);
  const num = s.type === 'number' ? parseDraft(s, value) : null;
  const helper = unit === 'days' && typeof num === 'number' ? approxDuration(num) : null;
  const limits =
    s.type === 'number' && (s.min !== null || s.max !== null)
      ? `${s.min !== null ? `min ${s.min}` : ''}${s.min !== null && s.max !== null ? ' · ' : ''}${s.max !== null ? `max ${s.max}` : ''}`
      : null;

  return (
    <div className={cn('space-y-1.5 px-4 py-4', edited && 'bg-primary-soft/30')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-semibold">
            {s.label}
          </Label>
          <p id={`${id}-desc`} className="text-muted-foreground mt-0.5 text-xs">
            {s.description}
          </p>
        </div>
        {s.type === 'boolean' && (
          <Switch
            id={id}
            checked={value === true}
            aria-describedby={`${id}-desc`}
            onCheckedChange={onChange}
          />
        )}
      </div>

      {s.type === 'number' && (
        <div className="flex max-w-xs items-center gap-2">
          <Input
            id={id}
            inputMode="decimal"
            value={String(value)}
            aria-invalid={!!error}
            aria-describedby={`${id}-desc ${id}-msg`}
            className="tabular"
            onChange={(e) => onChange(e.target.value)}
          />
          {unit && <span className="text-muted-foreground text-sm">{unit}</span>}
        </div>
      )}
      {s.type === 'text' && (
        <Input
          id={id}
          value={String(value)}
          aria-invalid={!!error}
          aria-describedby={`${id}-desc ${id}-msg`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {s.type === 'longText' && (
        <Textarea
          id={id}
          rows={5}
          value={String(value)}
          aria-invalid={!!error}
          aria-describedby={`${id}-desc ${id}-msg`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      <p
        id={`${id}-msg`}
        role={error ? 'alert' : undefined}
        className={cn('text-xs', error ? 'text-danger' : 'sr-only')}
      >
        {error ?? ''}
      </p>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {helper && <span>{helper}</span>}
        {limits && <span>{limits}</span>}
        <span>Default: {formatDefault(s)}</span>
        {!s.isDefault && (
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0 text-xs"
            disabled={resetting}
            onClick={onReset}
          >
            {resetting ? 'Resetting…' : 'Reset to default'}
          </Button>
        )}
      </div>
    </div>
  );
}
