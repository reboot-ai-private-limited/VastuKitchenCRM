'use client';

import type { ProposalBlock, ProposalBlockType } from '@vastu/contracts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const BLOCK_LABELS: Record<ProposalBlockType, string> = {
  heading: 'Heading',
  richText: 'Text',
  stats: 'Key numbers',
  bullets: 'Bullet list',
  steps: 'Numbered steps',
  image: 'Picture',
  gallery: 'Picture grid',
  team: 'Team',
  logos: 'Brands we use',
  quote: 'Customer quote',
  specs: 'Spec table',
  pricingTable: 'Price table (live)',
  notes: 'Notes (live)',
  terms: 'Terms (live)',
  paymentSchedule: 'Payment schedule',
  contactCard: 'Contact card',
  signature: 'Signature lines',
};

export const BLOCK_TYPES = Object.keys(BLOCK_LABELS) as ProposalBlockType[];

/** A fresh block of a type, with a sensible starting text. */
export function newBlock(type: ProposalBlockType): ProposalBlock {
  switch (type) {
    case 'heading':
      return { type, text: 'A heading' };
    case 'richText':
      return { type, text: 'Write here. Use {{client.name}} to put the customer’s name.' };
    case 'stats':
      return {
        type,
        items: [
          { value: '14+', label: 'Years' },
          { value: '500+', label: 'Projects' },
        ],
      };
    case 'bullets':
      return { type, items: ['First point', 'Second point'], columns: 1 };
    case 'steps':
      return { type, items: [{ title: 'Step one', text: 'What happens' }] };
    case 'image':
      return {
        type,
        src: 'https://vaastukitchen.com/home-slider/vastu1.jpg',
        alt: 'Picture',
        height: 300,
      };
    case 'gallery':
      return {
        type,
        images: [{ src: 'https://vaastukitchen.com/assets/projects/kitchen.jpg', alt: 'Kitchen' }],
        columns: 3,
      };
    case 'team':
      return { type, members: [{ name: 'Name', role: 'Role' }] };
    case 'logos':
      return { type, names: ['Blum', 'Hafele'] };
    case 'quote':
      return { type, text: 'A kind word from a customer.', author: 'Customer name' };
    case 'specs':
      return { type, rows: [{ label: 'Label', value: 'Value' }] };
    case 'paymentSchedule':
      return {
        type,
        rows: [
          { label: 'On order', percent: 50 },
          { label: 'On handover', percent: 50 },
        ],
      };
    case 'signature':
      return { type, leftLabel: 'For Vaastu Kitchen', rightLabel: 'Accepted by {{client.name}}' };
    case 'pricingTable':
    case 'notes':
    case 'terms':
    case 'contactCard':
      return { type };
  }
}

const toLines = (items: string[]) => items.join('\n');
const fromLines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** Rows as `a | b` lines: compact to edit, easy to paste from a spreadsheet. */
const toPairs = <T extends Record<string, unknown>>(rows: T[], keys: Array<keyof T>) =>
  rows.map((r) => keys.map((k) => String(r[k] ?? '')).join(' | ')).join('\n');
const fromPairs = (s: string, n: number) =>
  s
    .split('\n')
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p[0])
    .map((p) => Array.from({ length: n }, (_, i) => p[i] ?? ''));

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>}
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  area,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {area ? (
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

function Pick<T extends number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`h-8 rounded-md border px-3 text-sm ${o === value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}
          >
            {o}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** The settings form for one block. Live blocks (price table, notes, terms) have nothing to set. */
export function BlockFields({
  block,
  onChange,
}: {
  block: ProposalBlock;
  onChange: (b: ProposalBlock) => void;
}) {
  const b = block;
  switch (b.type) {
    case 'heading':
      return (
        <div className="space-y-2">
          <Text
            label="Small line above"
            value={b.eyebrow ?? ''}
            onChange={(v) => onChange({ ...b, ...(v ? { eyebrow: v } : { eyebrow: undefined }) })}
          />
          <Text label="Heading" value={b.text} onChange={(v) => onChange({ ...b, text: v })} />
        </div>
      );
    case 'richText':
      return (
        <Text
          label="Text"
          area
          rows={7}
          value={b.text}
          hint="A blank line starts a new paragraph. Tokens: {{client.name}}, {{client.address}}, {{proposal.number}}, {{total}}…"
          onChange={(v) => onChange({ ...b, text: v })}
        />
      );
    case 'stats':
      return (
        <Text
          label="Numbers"
          area
          value={toPairs(b.items, ['value', 'label'])}
          hint="One per line: value | label (up to 6)"
          onChange={(v) =>
            onChange({
              ...b,
              items: fromPairs(v, 2)
                .slice(0, 6)
                .map(([value, label]) => ({ value: value!, label: label! })),
            })
          }
        />
      );
    case 'bullets':
      return (
        <div className="space-y-2">
          <Text
            label="Title"
            value={b.title ?? ''}
            onChange={(v) => onChange({ ...b, title: v || undefined })}
          />
          <Text
            label="Points"
            area
            value={toLines(b.items)}
            hint="One per line"
            onChange={(v) => onChange({ ...b, items: fromLines(v) })}
          />
          <Pick
            label="Columns"
            value={b.columns}
            options={[1, 2]}
            onChange={(v) => onChange({ ...b, columns: v })}
          />
        </div>
      );
    case 'steps':
      return (
        <div className="space-y-2">
          <Text
            label="Title"
            value={b.title ?? ''}
            onChange={(v) => onChange({ ...b, title: v || undefined })}
          />
          <Text
            label="Steps"
            area
            rows={7}
            value={toPairs(b.items, ['title', 'text'])}
            hint="One per line: step | what happens"
            onChange={(v) =>
              onChange({
                ...b,
                items: fromPairs(v, 2).map(([title, text]) => ({
                  title: title!,
                  ...(text ? { text } : {}),
                })),
              })
            }
          />
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          <Text
            label="Picture address (URL)"
            value={b.src}
            onChange={(v) => onChange({ ...b, src: v })}
          />
          <Text
            label="Describe the picture"
            value={b.alt}
            onChange={(v) => onChange({ ...b, alt: v })}
          />
          <Text
            label="Caption"
            value={b.caption ?? ''}
            onChange={(v) => onChange({ ...b, caption: v || undefined })}
          />
          <Num
            label="Height (px)"
            value={b.height}
            onChange={(v) => onChange({ ...b, height: Math.min(700, Math.max(80, v || 300)) })}
          />
        </div>
      );
    case 'gallery':
      return (
        <div className="space-y-2">
          <Text
            label="Pictures"
            area
            rows={6}
            value={toPairs(b.images, ['src', 'alt'])}
            hint="One per line: picture URL | description (up to 9)"
            onChange={(v) =>
              onChange({
                ...b,
                images: fromPairs(v, 2)
                  .slice(0, 9)
                  .map(([src, alt]) => ({ src: src!, alt: alt || 'Picture' })),
              })
            }
          />
          <Pick
            label="Columns"
            value={b.columns}
            options={[2, 3]}
            onChange={(v) => onChange({ ...b, columns: v })}
          />
        </div>
      );
    case 'team':
      return (
        <div className="space-y-2">
          <Text
            label="Title"
            value={b.title ?? ''}
            onChange={(v) => onChange({ ...b, title: v || undefined })}
          />
          <Text
            label="People"
            area
            value={toPairs(b.members, ['name', 'role'])}
            hint="One per line: name | role"
            onChange={(v) =>
              onChange({
                ...b,
                members: fromPairs(v, 2)
                  .slice(0, 8)
                  .map(([name, role]) => ({ name: name!, role: role! })),
              })
            }
          />
        </div>
      );
    case 'logos':
      return (
        <div className="space-y-2">
          <Text
            label="Title"
            value={b.title ?? ''}
            onChange={(v) => onChange({ ...b, title: v || undefined })}
          />
          <Text
            label="Brands"
            area
            value={toLines(b.names)}
            hint="One per line"
            onChange={(v) => onChange({ ...b, names: fromLines(v).slice(0, 16) })}
          />
        </div>
      );
    case 'quote':
      return (
        <div className="space-y-2">
          <Text label="Quote" area value={b.text} onChange={(v) => onChange({ ...b, text: v })} />
          <Text
            label="Who said it"
            value={b.author}
            onChange={(v) => onChange({ ...b, author: v })}
          />
          <Text
            label="Their role"
            value={b.role ?? ''}
            onChange={(v) => onChange({ ...b, role: v || undefined })}
          />
        </div>
      );
    case 'specs':
      return (
        <div className="space-y-2">
          <Text
            label="Title"
            value={b.title ?? ''}
            onChange={(v) => onChange({ ...b, title: v || undefined })}
          />
          <Text
            label="Rows"
            area
            rows={6}
            value={toPairs(b.rows, ['label', 'value'])}
            hint="One per line: label | value. Tokens work here too."
            onChange={(v) =>
              onChange({
                ...b,
                rows: fromPairs(v, 2)
                  .slice(0, 20)
                  .map(([label, value]) => ({ label: label!, value: value! })),
              })
            }
          />
        </div>
      );
    case 'paymentSchedule':
      return (
        <div className="space-y-2">
          <Text
            label="Title"
            value={b.title ?? ''}
            onChange={(v) => onChange({ ...b, title: v || undefined })}
          />
          <Text
            label="Stages"
            area
            value={toPairs(b.rows, ['percent', 'label'])}
            hint="One per line: percent | when. Amounts are worked out from the total."
            onChange={(v) =>
              onChange({
                ...b,
                rows: fromPairs(v, 2)
                  .slice(0, 8)
                  .map(([percent, label]) => ({
                    percent: Math.min(100, Math.max(1, Number(percent) || 0)),
                    label: label!,
                  })),
              })
            }
          />
        </div>
      );
    case 'signature':
      return (
        <div className="space-y-2">
          <Text
            label="Left line"
            value={b.leftLabel}
            onChange={(v) => onChange({ ...b, leftLabel: v })}
          />
          <Text
            label="Right line"
            value={b.rightLabel}
            onChange={(v) => onChange({ ...b, rightLabel: v })}
          />
        </div>
      );
    case 'pricingTable':
    case 'notes':
    case 'terms':
    case 'contactCard':
      return (
        <p className="text-muted-foreground text-xs">
          Filled in from the proposal and company details. Nothing to set.
        </p>
      );
  }
}
