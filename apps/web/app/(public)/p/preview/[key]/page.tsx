import { BUILTIN_PROPOSAL_TEMPLATES, findBuiltinTemplate } from '@vastu/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DocumentView } from '@/components/proposals/proposal-document';
import { TemplateDocument } from '@/components/proposals/render/template-document';
import { playfair } from '@/lib/fonts';
import { PrintButton } from '../../[token]/print-button';

export const metadata: Metadata = { title: 'Template preview', robots: { index: false, follow: false } };

/** Development aid: every built-in template with sample data. Not served in production. */
const SAMPLE_ITEMS = [
  ['L-shaped modular kitchen', 'Base and wall units, soft-close, 18mm BWP carcass', 1, 385000],
  ['Island unit', 'Breakfast counter with storage', 1, 95000],
  ['Tall unit with appliance housing', 'Oven and microwave bay', 1, 72000],
  ['Countertop', 'Quartz, 20mm', 28, 2400],
  ['Chimney and hob', 'Built-in, supply and fit', 1, 64000],
  ['Wardrobe, master bedroom', 'Sliding shutters, laminate', 1, 118000],
  ['TV unit', 'Wall-mounted with back panel', 1, 54000],
  ['Electrical and plumbing', 'Points, fittings and labour', 1, 36000],
] as const;

function sample(): DocumentView {
  const items = SAMPLE_ITEMS.map(([title, description, quantity, unitPrice]) => ({
    title,
    description,
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
  }));
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return {
    number: 'VK-2026-0042',
    title: 'Modular kitchen and interiors',
    issuedAt: '2026-11-12T09:00:00.000Z',
    validUntil: '2026-12-12T00:00:00.000Z',
    customer: { name: 'Asha Rai', city: 'Siliguri', siteAddress: 'Flat 4B, Hill Cart Road' },
    items,
    subtotal,
    discount: 25000,
    total: subtotal - 25000,
    notes: 'Appliances are not included. Final countertop colour to be confirmed at material freeze.',
    terms:
      '1. This quotation is valid for 30 days.\n2. 50% advance confirms the order.\n3. Delivery within 8 weeks of material freeze.\n4. One-year warranty on workmanship; manufacturer warranty on hardware.',
    company: {
      name: 'Vaastu Kitchen',
      tagline: 'Design studio built on precision, trust and premium execution',
      address: '3rd Mile, Sevoke Rd, Salugara, Siliguri, West Bengal 734001',
      phone: '+91 98004 88882',
    },
    sentBy: 'Sayantra Roy',
  };
}

export default async function TemplatePreview({ params }: { params: Promise<{ key: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { key } = await params;
  const template = findBuiltinTemplate(key);
  if (!template) notFound();
  return (
    <main className={`${playfair.variable} bg-secondary/60 min-h-dvh px-3 py-6 sm:px-6 print:bg-white print:p-0`}>
      <div className="mx-auto max-w-[794px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <nav className="flex gap-3 text-sm">
            {BUILTIN_PROPOSAL_TEMPLATES.map((t) => (
              <Link key={t.key} href={`/p/preview/${t.key}`} className={t.key === key ? 'font-semibold underline' : ''}>
                {t.name}
              </Link>
            ))}
          </nav>
          <PrintButton />
        </div>
        <TemplateDocument doc={sample()} template={template} />
      </div>
    </main>
  );
}
