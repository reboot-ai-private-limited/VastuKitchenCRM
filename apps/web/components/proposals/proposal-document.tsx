import { formatDate, formatINR } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface DocumentView {
  number?: string;
  title: string;
  issuedAt: string | null;
  validUntil: string | null;
  isExpired?: boolean;
  customer: { name: string; city: string | null; siteAddress: string | null };
  items: Array<{
    title: string;
    description: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  terms: string;
  company?: { name: string; tagline: string; address: string; phone: string };
  sentBy?: string | null;
}

/**
 * The proposal as the customer sees it. One component for the live builder preview, the sent view
 * and the public page, so what you check is what they get. A paper sheet: prints on A4.
 */
export function ProposalDocument({ doc, className }: { doc: DocumentView; className?: string }) {
  return (
    <article
      className={cn(
        'bg-card text-card-foreground rounded-xl border p-6 shadow-card sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="font-display text-2xl font-semibold tracking-tight">
            {doc.company?.name ?? 'Vaastu Kitchen'}
          </p>
          {doc.company?.tagline && (
            <p className="text-muted-foreground text-sm">{doc.company.tagline}</p>
          )}
          {doc.company && (
            <p className="text-muted-foreground mt-2 text-xs">
              {doc.company.address}
              {doc.company.phone ? ` · ${doc.company.phone}` : ''}
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Proposal
          </p>
          <p className="tabular font-semibold">{doc.number ?? 'Draft'}</p>
          {doc.issuedAt && (
            <p className="text-muted-foreground text-xs">{formatDate(doc.issuedAt)}</p>
          )}
        </div>
      </header>

      {doc.isExpired && (
        <p role="note" className="bg-warning-soft text-warning mt-5 rounded-md p-3 text-sm">
          This proposal expired on{' '}
          {doc.validUntil ? formatDate(doc.validUntil) : 'its validity date'}. Please contact us for
          an updated quote.
        </p>
      )}

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Prepared for
          </p>
          <p className="mt-1 font-semibold">{doc.customer.name}</p>
          {doc.customer.city && (
            <p className="text-muted-foreground text-sm">{doc.customer.city}</p>
          )}
          {doc.customer.siteAddress && (
            <p className="text-muted-foreground text-sm">{doc.customer.siteAddress}</p>
          )}
        </div>
        {doc.validUntil && !doc.isExpired && (
          <div className="sm:text-right">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Valid until
            </p>
            <p className="mt-1 font-semibold">{formatDate(doc.validUntil)}</p>
          </div>
        )}
      </section>

      <h1 className="font-display mt-8 text-xl font-semibold">{doc.title}</h1>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="py-2 pr-3 font-semibold">Item</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Rate</th>
              <th className="py-2 pl-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {doc.items.map((i, n) => (
              <tr key={n} className="align-top">
                <td className="py-3 pr-3">
                  <p className="font-medium">{i.title}</p>
                  {i.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs whitespace-pre-line">
                      {i.description}
                    </p>
                  )}
                </td>
                <td className="tabular px-3 py-3 text-right whitespace-nowrap">{i.quantity}</td>
                <td className="tabular px-3 py-3 text-right whitespace-nowrap">
                  {formatINR(i.unitPrice)}
                </td>
                <td className="tabular py-3 pl-3 text-right font-medium whitespace-nowrap">
                  {formatINR(i.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="tabular mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatINR(doc.subtotal)}</dd>
        </div>
        {doc.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd>− {formatINR(doc.discount)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t pt-2">
          <dt className="font-semibold">Total</dt>
          <dd className="font-display text-2xl font-semibold">{formatINR(doc.total)}</dd>
        </div>
      </dl>

      {doc.notes && (
        <section className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Notes
          </h2>
          <p className="mt-1 text-sm whitespace-pre-line">{doc.notes}</p>
        </section>
      )}
      {doc.terms && (
        <section className="mt-6">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Terms
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed whitespace-pre-line">
            {doc.terms}
          </p>
        </section>
      )}
      {doc.sentBy && (
        <p className="text-muted-foreground mt-8 border-t pt-4 text-xs">Prepared by {doc.sentBy}</p>
      )}
    </article>
  );
}
