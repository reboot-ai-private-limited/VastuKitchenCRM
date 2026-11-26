'use client';

import {
  PHONE_COUNTRIES,
  joinPhone,
  splitPhone,
  type PhoneDialCode,
} from '@vastu/contracts';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** Country-code picker (India +91, Bhutan +975, Nepal +977) + local mobile digits. */
export function PhoneInput({
  id,
  value,
  onChange,
  disabled,
  autoFocus,
  autoComplete = 'off',
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: PhoneInputProps) {
  const parsed = splitPhone(value);
  const [dial, setDial] = useState<PhoneDialCode>(parsed.dial);

  useEffect(() => {
    if (value.trim()) setDial(splitPhone(value).dial);
  }, [value]);

  const country = PHONE_COUNTRIES.find((c) => c.dial === dial) ?? PHONE_COUNTRIES[0];
  const local = value.trim() ? parsed.local : '';

  function handleDialChange(nextDial: PhoneDialCode) {
    const nextCountry = PHONE_COUNTRIES.find((c) => c.dial === nextDial) ?? PHONE_COUNTRIES[0];
    setDial(nextDial);
    const trimmed = local.slice(0, nextCountry.digits);
    onChange(joinPhone(nextDial, trimmed));
  }

  function handleLocalChange(raw: string) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('+975') || trimmed.startsWith('+977') || trimmed.startsWith('+91')) {
      const next = splitPhone(trimmed);
      setDial(next.dial);
      onChange(joinPhone(next.dial, next.local));
      return;
    }
    const digits = raw.replace(/\D/g, '').slice(0, country.digits);
    onChange(joinPhone(dial, digits));
  }

  return (
    <div className={cn('flex gap-1.5', className)}>
      <Select value={dial} onValueChange={(v) => handleDialChange(v as PhoneDialCode)} disabled={disabled}>
        <SelectTrigger className="w-[104px] shrink-0 tabular" aria-label="Country code">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.dial}>
              {c.code} {c.dial}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        inputMode="tel"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={country.digits}
        placeholder={country.placeholder}
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="tabular min-w-0 flex-1"
      />
    </div>
  );
}
