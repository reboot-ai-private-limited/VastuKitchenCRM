import type { PublicProposalDto } from '@vastu/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateDocument } from '@/components/proposals/render/template-document';
import { playfair } from '@/lib/fonts';
import { PrintButton } from './print-button';
import { SeenPing } from './seen-ping';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your proposal',
  robots: { index: false, follow: false },
};

async function load(token: string): Promise<PublicProposalDto | null> {
  try {
    // A plain server GET records nothing: only the browser's SeenPing counts as a view.
    const res = await fetch(`${API_ORIGIN}/api/public/proposals/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`proposal fetch failed: ${res.status}`);
    return ((await res.json()) as { data: PublicProposalDto }).data;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('proposal fetch failed')) throw e;
    throw new Error('proposal fetch failed: unreachable');
  }
}

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const p = await load(token);
  if (!p) notFound();
  return (
    <main
      className={`${playfair.variable} bg-secondary/60 min-h-dvh px-3 py-6 sm:px-6 sm:py-10 print:bg-white print:p-0`}
    >
      <div className="mx-auto max-w-[794px] space-y-4">
        <div className="flex justify-end print:hidden">
          <PrintButton />
        </div>
        <TemplateDocument
          template={p.template}
          doc={{
            number: p.number,
            title: p.title,
            issuedAt: p.issuedAt,
            validUntil: p.validUntil,
            isExpired: p.isExpired,
            customer: p.customer,
            items: p.items,
            subtotal: p.subtotal,
            discount: p.discount,
            total: p.total,
            notes: p.notes,
            terms: p.terms,
            company: p.company,
            sentBy: p.sentBy?.name ?? null,
          }}
        />
      </div>
      <SeenPing token={token} />
    </main>
  );
}
