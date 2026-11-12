import { BUILTIN_PROPOSAL_TEMPLATES, findBuiltinTemplate } from '@vastu/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sampleDocument } from '@/components/proposals/render/sample-doc';
import { TemplateDocument } from '@/components/proposals/render/template-document';
import { playfair } from '@/lib/fonts';
import { PrintButton } from '../../[token]/print-button';

export const metadata: Metadata = {
  title: 'Template preview',
  robots: { index: false, follow: false },
};

/** Development aid: every built-in template with sample data. Not served in production. */
export default async function TemplatePreview({ params }: { params: Promise<{ key: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { key } = await params;
  const template = findBuiltinTemplate(key);
  if (!template) notFound();
  return (
    <main
      className={`${playfair.variable} bg-secondary/60 min-h-dvh px-3 py-6 sm:px-6 print:bg-white print:p-0`}
    >
      <div className="mx-auto max-w-[794px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <nav className="flex gap-3 text-sm">
            {BUILTIN_PROPOSAL_TEMPLATES.map((t) => (
              <Link
                key={t.key}
                href={`/p/preview/${t.key}`}
                className={t.key === key ? 'font-semibold underline' : ''}
              >
                {t.name}
              </Link>
            ))}
          </nav>
          <PrintButton />
        </div>
        <TemplateDocument doc={sampleDocument()} template={template} />
      </div>
    </main>
  );
}
