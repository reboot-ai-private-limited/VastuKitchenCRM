'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProposalTemplates } from '@/lib/api/proposal-templates';

/** Choose how the proposal looks. Built-in templates first, then the studio's own. */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const { data, isPending } = useProposalTemplates();
  const items = data?.items ?? [];
  const current = items.find((t) => t.key === value);
  return (
    <div>
      <Label htmlFor="p-template">Design</Label>
      <Select value={value} onValueChange={onChange} disabled={isPending && items.length === 0}>
        <SelectTrigger id="p-template" className="w-full">
          <SelectValue placeholder={isPending ? 'Loading…' : 'Choose a design'} />
        </SelectTrigger>
        <SelectContent>
          {items.map((t) => (
            <SelectItem key={t.key} value={t.key}>
              {t.name} · {t.pageCount} pages
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && <p className="text-muted-foreground mt-1 text-xs">{current.description}</p>}
    </div>
  );
}
