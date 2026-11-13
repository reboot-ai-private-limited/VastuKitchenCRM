/* eslint-disable @next/next/no-img-element -- template pictures are remote and printed as-is */
import type { ProposalBlock, ProposalTheme } from '@vastu/contracts';
import { formatINR } from '@/lib/format';
import type { DocumentView } from '../proposal-document';
import { fillTokens } from './tokens';

export interface BlockCtx {
  theme: ProposalTheme;
  doc: DocumentView;
  values: Record<string, string>;
  /** Pricing rows for this sheet (the table can continue over several sheets). */
  rows?: { items: DocumentView['items']; offset: number; showTotals: boolean };
}

export const headingClass = (t: ProposalTheme) =>
  t.headingFont === 'serif' ? 'font-display font-semibold' : 'font-sans font-bold tracking-tight';

const eyebrow = 'text-[11px] font-semibold tracking-[0.18em] uppercase';

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </>
  );
}

export function Block({ block, ctx }: { block: ProposalBlock; ctx: BlockCtx }) {
  const { theme, doc, values } = ctx;
  const f = (s: string) => fillTokens(s, values);
  const h = headingClass(theme);

  switch (block.type) {
    case 'heading':
      return (
        <div>
          {block.eyebrow && (
            <p className={eyebrow} style={{ color: 'var(--t-primary)' }}>
              {f(block.eyebrow)}
            </p>
          )}
          <h2 className={`${h} mt-1.5 text-[30px] leading-[1.15]`}>{f(block.text)}</h2>
        </div>
      );

    case 'richText':
      return (
        <div className="space-y-3 text-[14px] leading-relaxed opacity-85">
          <Paragraphs text={f(block.text)} />
        </div>
      );

    case 'stats':
      return (
        <div className="grid grid-cols-3 gap-4">
          {block.items.map((s) => (
            <div
              key={s.label}
              className="rounded-lg p-4 text-center"
              style={{ background: 'var(--t-tint)' }}
            >
              <p className={`${h} text-[32px] leading-none`} style={{ color: 'var(--t-primary)' }}>
                {s.value}
              </p>
              <p className="mt-2 text-[12px] opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      );

    case 'bullets':
      return (
        <div>
          {block.title && <p className={`${h} mb-2 text-[18px]`}>{f(block.title)}</p>}
          <ul
            className={`grid gap-x-8 gap-y-1.5 text-[13px] ${block.columns === 2 ? 'grid-cols-2' : ''}`}
          >
            {block.items.map((i) => (
              <li key={i} className="flex gap-2">
                <span
                  className="mt-[7px] size-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--t-primary)' }}
                />
                {f(i)}
              </li>
            ))}
          </ul>
        </div>
      );

    case 'steps':
      return (
        <div>
          {block.title && <p className={`${h} mb-3 text-[18px]`}>{f(block.title)}</p>}
          <ol className="grid grid-cols-2 gap-x-8 gap-y-3">
            {block.items.map((s, n) => (
              <li key={s.title} className="flex gap-3">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                  style={{ background: 'var(--t-primary)' }}
                >
                  {n + 1}
                </span>
                <span className="text-[13px] leading-snug">
                  <span className="font-semibold">{s.title}</span>
                  {s.text && <span className="block text-[12px] opacity-70">{s.text}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );

    case 'image':
      return (
        <figure>
          <img
            src={block.src}
            alt={block.alt}
            className="w-full rounded-lg object-cover"
            style={{ height: block.height }}
          />
          {block.caption && (
            <figcaption className="mt-1.5 text-center text-[11px] opacity-60">
              {f(block.caption)}
            </figcaption>
          )}
        </figure>
      );

    case 'gallery':
      return (
        <div className={`grid gap-2 ${block.columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {block.images.map((g) => (
            <img
              key={g.src}
              src={g.src}
              alt={g.alt}
              className="h-[130px] w-full rounded-md object-cover"
            />
          ))}
        </div>
      );

    case 'team':
      return (
        <div>
          {block.title && <p className={`${h} mb-3 text-[18px]`}>{f(block.title)}</p>}
          <div className="grid grid-cols-2 gap-3">
            {block.members.map((m) => (
              <div key={m.name} className="rounded-lg p-3" style={{ background: 'var(--t-tint)' }}>
                <p className="text-[14px] font-semibold">{m.name}</p>
                <p className="text-[12px] opacity-70">{m.role}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case 'logos':
      return (
        <div>
          {block.title && <p className={`${eyebrow} mb-2 opacity-60`}>{f(block.title)}</p>}
          <div className="flex flex-wrap gap-2">
            {block.names.map((n) => (
              <span
                key={n}
                className="rounded-full border px-3 py-1 text-[12px] font-medium"
                style={{ borderColor: 'var(--t-accent)' }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 py-1 pl-5" style={{ borderColor: 'var(--t-primary)' }}>
          <p className={`${h} text-[20px] leading-snug italic`}>“{f(block.text)}”</p>
          <footer className="mt-2 text-[12px] opacity-70">
            <span className="font-semibold">{block.author}</span>
            {block.role ? `, ${block.role}` : ''}
          </footer>
        </blockquote>
      );

    case 'specs':
      return (
        <div>
          {block.title && <p className={`${h} mb-2 text-[18px]`}>{f(block.title)}</p>}
          <dl
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--t-tint)' }}
          >
            {block.rows
              .map((r) => ({ label: r.label, value: f(r.value) }))
              .filter((r) => r.value.trim() !== '')
              .map((r, n) => (
                <div
                  key={r.label}
                  className="ps-spec grid grid-cols-[170px_1fr] gap-3 px-4 py-2 text-[13px]"
                  style={n % 2 === 0 ? { background: 'var(--t-tint)' } : undefined}
                >
                  <dt className="font-semibold opacity-70">{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
          </dl>
        </div>
      );

    case 'pricingTable': {
      const rows = ctx.rows ?? { items: doc.items, offset: 0, showTotals: true };
      return (
        <div>
          <table className="ps-table w-full text-[13px]">
            <thead>
              <tr
                className="text-left text-[11px] tracking-wider text-white uppercase"
                style={{ background: 'var(--t-primary)' }}
              >
                <th className="w-8 rounded-tl-md px-3 py-2">#</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="rounded-tr-md px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.items.map((i, n) => (
                <tr
                  key={rows.offset + n}
                  className="align-top"
                  style={n % 2 === 1 ? { background: 'var(--t-tint)' } : undefined}
                >
                  <td className="px-3 py-2.5 opacity-60">{rows.offset + n + 1}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold">{i.title}</p>
                    {i.description && (
                      <p className="mt-0.5 text-[11px] whitespace-pre-line opacity-65">
                        {i.description}
                      </p>
                    )}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">{i.quantity}</td>
                  <td className="tabular px-3 py-2.5 text-right whitespace-nowrap">
                    {formatINR(i.unitPrice)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {formatINR(i.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.showTotals ? (
            <dl className="ps-totals tabular mt-4 ml-auto w-[300px] space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="opacity-65">Subtotal</dt>
                <dd>{formatINR(doc.subtotal)}</dd>
              </div>
              {doc.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="opacity-65">Discount</dt>
                  <dd>− {formatINR(doc.discount)}</dd>
                </div>
              )}
              <div
                className="flex items-baseline justify-between rounded-md px-3 py-2.5 text-white"
                style={{ background: 'var(--t-ink)' }}
              >
                <dt className="text-[12px] tracking-wider uppercase">Total</dt>
                <dd className={`${h} text-[24px]`}>{formatINR(doc.total)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-right text-[11px] opacity-60">Continued on the next page</p>
          )}
        </div>
      );
    }

    case 'notes':
      return doc.notes ? (
        <div className="rounded-lg p-4" style={{ background: 'var(--t-tint)' }}>
          <p className={`${eyebrow} opacity-60`}>Notes</p>
          <p className="mt-1 text-[13px] whitespace-pre-line">{doc.notes}</p>
        </div>
      ) : null;

    case 'terms':
      return doc.terms ? (
        <div>
          <p className={`${eyebrow} opacity-60`}>Terms</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed whitespace-pre-line opacity-80">
            {doc.terms}
          </p>
        </div>
      ) : null;

    case 'paymentSchedule':
      return (
        <div>
          {block.title && <p className={`${h} mb-2 text-[18px]`}>{f(block.title)}</p>}
          <div
            className="overflow-hidden rounded-lg border text-[13px]"
            style={{ borderColor: 'var(--t-tint)' }}
          >
            {block.rows.map((r, n) => (
              <div
                key={r.label}
                className="tabular flex items-center justify-between gap-4 px-4 py-2.5"
                style={n % 2 === 0 ? { background: 'var(--t-tint)' } : undefined}
              >
                <span>
                  <span className="font-semibold">{r.percent}%</span> · {r.label}
                </span>
                <span className="font-semibold">
                  {formatINR(Math.round((doc.total * r.percent) / 100))}
                </span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'contactCard': {
      const c = doc.company;
      return (
        <div className="space-y-1 text-[14px]">
          <p className={`${h} text-[20px]`}>{c?.name ?? 'Vaastu Kitchen'}</p>
          {c?.tagline && <p className="opacity-70">{c.tagline}</p>}
          {c?.phone && <p className="font-semibold">{c.phone}</p>}
          {c?.address && <p className="opacity-70">{c.address}</p>}
          <p className="opacity-70">vaastukitchen.com</p>
          {doc.sentBy && <p className="pt-2 text-[12px] opacity-60">Prepared by {doc.sentBy}</p>}
        </div>
      );
    }

    case 'signature':
      return (
        <div className="grid grid-cols-2 gap-16 pt-14 text-[12px]">
          {[block.leftLabel, block.rightLabel].map((l) => (
            <div key={l} className="border-t pt-2" style={{ borderColor: 'var(--t-ink)' }}>
              {f(l)}
            </div>
          ))}
        </div>
      );
  }
}
