import type { ProposalPageDef, ProposalTemplate } from '@vastu/contracts';
import type { DocumentView } from '../proposal-document';
import type { BlockCtx } from './blocks';
import { PageView } from './pages';
import { Sheet } from './sheet';
import { tokenValues } from './tokens';

/** Rows that fit under a page heading, and on a continuation sheet. Tuned for A4 at 13px text. */
export const FIRST_PAGE_ROWS = 10;
export const NEXT_PAGE_ROWS = 18;

export interface PlannedSheet {
  def: ProposalPageDef;
  rows?: BlockCtx['rows'];
  continued: boolean;
}

/**
 * Turns a template's pages into the sheets to print. Only the price table can grow past one
 * sheet, so a pricing page with many items becomes several: the table splits across them and the
 * totals (plus any blocks after the table) land on the last.
 */
export function planSheets(template: ProposalTemplate, doc: DocumentView): PlannedSheet[] {
  const out: PlannedSheet[] = [];
  for (const def of template.pages) {
    const at = def.blocks.findIndex((b) => b.type === 'pricingTable');
    if (def.kind !== 'pricing' || at < 0 || doc.items.length <= FIRST_PAGE_ROWS) {
      out.push({ def, continued: false });
      continue;
    }
    const before = def.blocks.slice(0, at);
    const after = def.blocks.slice(at + 1);
    const table = def.blocks[at]!;
    const chunks: DocumentView['items'][] = [doc.items.slice(0, FIRST_PAGE_ROWS)];
    for (let i = FIRST_PAGE_ROWS; i < doc.items.length; i += NEXT_PAGE_ROWS) {
      chunks.push(doc.items.slice(i, i + NEXT_PAGE_ROWS));
    }
    let offset = 0;
    chunks.forEach((items, n) => {
      const last = n === chunks.length - 1;
      out.push({
        def: { ...def, blocks: [...(n === 0 ? before : []), table, ...(last ? after : [])] },
        rows: { items, offset, showTotals: last },
        continued: n > 0,
      });
      offset += items.length;
    });
  }
  return out;
}

/**
 * The proposal as a stack of A4 sheets, rendered from a template. The same component serves the
 * builder preview, the sent view and the public page, so what is checked is what the customer
 * gets. "Save as PDF" in the browser's print dialog produces the PDF; nothing is stored.
 */
export function TemplateDocument({ doc, template }: { doc: DocumentView; template: ProposalTemplate }) {
  const values = tokenValues(doc);
  const sheets = planSheets(template, doc);
  return (
    <div className="proposal-stack space-y-6 print:space-y-0">
      <style>{PRINT_CSS}</style>
      {sheets.map((s, i) => (
        <Sheet key={`${s.def.id}-${i}`} theme={template.theme}>
          <PageView
            def={s.def}
            template={template}
            ctx={{ theme: template.theme, doc, values, rows: s.rows }}
            n={i + 1}
            of={sheets.length}
            continued={s.continued}
          />
        </Sheet>
      ))}
    </div>
  );
}

const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .proposal-sheet-wrap { max-width: none !important; width: 794px !important; height: 1122px !important; break-after: page; page-break-after: always; }
  .proposal-sheet { transform: none !important; width: 794px !important; height: 1122px !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .proposal-sheet-wrap:last-child { break-after: auto; page-break-after: auto; }
}
`;
