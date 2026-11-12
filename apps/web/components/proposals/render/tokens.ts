import type { DocumentView } from '../proposal-document';
import { formatDate, formatINR } from '@/lib/format';

/** `{{client.name}}` style tokens. An unknown token is left as written so a typo is visible. */
export function tokenValues(doc: DocumentView): Record<string, string> {
  const c = doc.company;
  return {
    'client.name': doc.customer.name,
    'client.city': doc.customer.city ?? '',
    'client.address': doc.customer.siteAddress ?? '',
    'proposal.number': doc.number ?? 'Draft',
    'proposal.title': doc.title,
    'proposal.date': doc.issuedAt ? formatDate(doc.issuedAt) : formatDate(new Date()),
    'proposal.validUntil': doc.validUntil ? formatDate(doc.validUntil) : '',
    total: formatINR(doc.total),
    preparedBy: doc.sentBy ?? '',
    'company.name': c?.name ?? 'Vaastu Kitchen',
    'company.phone': c?.phone ?? '',
    'company.address': c?.address ?? '',
  };
}

export function fillTokens(text: string, values: Record<string, string>): string {
  return (
    text
      .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole)
      // A token that was empty leaves ", " or a dangling separator behind.
      .replace(/(^|\n)[ \t,·]+(?=\S)/g, '$1')
      .replace(/[ \t,·]+(?=\n|$)/g, '')
  );
}
