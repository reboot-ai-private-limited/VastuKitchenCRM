import {
  createProposalBodySchema,
  updateProposalBodySchema,
  type CreateProposalBodyDto,
  type ProposalDto,
  type UpdateProposalBodyDto,
} from '@vastu/contracts';

/** What the API computes, so the live preview matches the saved proposal to the rupee. */
export function computeTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discount: number,
) {
  const lines = items.map((i) => Math.round(i.quantity * i.unitPrice));
  const subtotal = lines.reduce((a, b) => a + b, 0);
  return { lines, subtotal, total: subtotal - discount };
}

/** Draft → Sent → Seen. ("No action" needs the lead's status, which the list does not carry; the dashboard has it.) */
export type ProposalChip = { label: string; tone: 'neutral' | 'info' | 'accent' };
export function proposalChip(p: Pick<ProposalDto, 'status' | 'firstSeenAt'>): ProposalChip {
  if (p.status === 'DRAFT') return { label: 'Draft', tone: 'neutral' };
  if (p.firstSeenAt) return { label: 'Seen', tone: 'accent' };
  return { label: 'Sent', tone: 'info' };
}

/** The builder's form: strings while typing, numbers only when sending. */
export interface FormItem {
  key: string;
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
}
export interface ProposalForm {
  title: string;
  siteAddress: string;
  items: FormItem[];
  discount: string;
  notes: string;
  terms: string;
  /** `YYYY-MM-DD` or empty. */
  validUntil: string;
}

let seq = 0;
export const newItem = (over: Partial<FormItem> = {}): FormItem => ({
  key: `i${++seq}`,
  title: '',
  description: '',
  quantity: '1',
  unitPrice: '',
  ...over,
});

export const emptyForm = (): ProposalForm => ({
  title: 'Modular kitchen proposal',
  siteAddress: '',
  items: [newItem()],
  discount: '',
  notes: '',
  terms: '',
  validUntil: '',
});

export const formFromProposal = (p: ProposalDto): ProposalForm => ({
  title: p.title,
  siteAddress: p.customer.siteAddress ?? '',
  items: p.items.map((i) =>
    newItem({
      title: i.title,
      description: i.description ?? '',
      quantity: String(i.quantity),
      unitPrice: String(i.unitPrice),
    }),
  ),
  discount: p.discount ? String(p.discount) : '',
  notes: p.notes ?? '',
  terms: p.terms,
  validUntil: p.validUntil ? p.validUntil.slice(0, 10) : '',
});

const num = (s: string): number => (s.trim() === '' ? Number.NaN : Number(s.replace(/,/g, '')));

/** Numbers the preview can use even while the form is half-filled. */
export const previewItems = (f: ProposalForm) =>
  f.items.map((i) => ({
    title: i.title.trim() || 'Untitled item',
    description: i.description.trim() || null,
    quantity: Number.isFinite(num(i.quantity)) ? num(i.quantity) : 0,
    unitPrice: Number.isFinite(num(i.unitPrice)) ? Math.max(0, Math.round(num(i.unitPrice))) : 0,
  }));
export const previewDiscount = (f: ProposalForm): number =>
  Number.isFinite(num(f.discount)) ? Math.max(0, Math.round(num(f.discount))) : 0;

export type FormErrors = Record<string, string>;

const FRIENDLY: Array<[RegExp, string]> = [[/title/, 'Enter a title.']];

/** Form → API body, or the errors to show next to the fields. Keys look like `items.0.unitPrice`. */
export function buildBody(
  f: ProposalForm,
  leadId: string | null,
):
  | { ok: true; create: CreateProposalBodyDto | null; update: UpdateProposalBodyDto }
  | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  const items = f.items.map((i, n) => {
    const quantity = num(i.quantity);
    const unitPrice = num(i.unitPrice);
    if (!i.title.trim()) errors[`items.${n}.title`] = 'Enter what this line is.';
    if (!Number.isFinite(quantity) || quantity <= 0)
      errors[`items.${n}.quantity`] = 'Quantity must be more than 0.';
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isInteger(unitPrice))
      errors[`items.${n}.unitPrice`] = 'Enter a price in whole rupees.';
    return {
      title: i.title.trim(),
      ...(i.description.trim() ? { description: i.description.trim() } : {}),
      quantity,
      unitPrice,
    };
  });
  const discount = f.discount.trim() === '' ? 0 : num(f.discount);
  if (!Number.isFinite(discount) || discount < 0 || !Number.isInteger(discount))
    errors['discount'] = 'Enter the discount in whole rupees.';
  else if (Object.keys(errors).length === 0 && discount > computeTotals(items, 0).subtotal)
    errors['discount'] = 'The discount can’t be more than the subtotal.';
  if (!f.title.trim()) errors['title'] = 'Enter a title.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const common = {
    title: f.title.trim(),
    items,
    discount,
    ...(f.terms.trim() ? { terms: f.terms.trim() } : {}),
  };
  const update = updateProposalBodySchema.safeParse({
    ...common,
    siteAddress: f.siteAddress.trim() || null,
    notes: f.notes.trim() || null,
    validUntil: f.validUntil || null,
  });
  if (!update.success) return { ok: false, errors: zodErrors(update.error.issues) };
  let create: CreateProposalBodyDto | null = null;
  if (leadId) {
    const parsed = createProposalBodySchema.safeParse({
      leadId,
      ...common,
      ...(f.siteAddress.trim() ? { siteAddress: f.siteAddress.trim() } : {}),
      ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
      ...(f.validUntil ? { validUntil: f.validUntil } : {}),
    });
    if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error.issues) };
    create = parsed.data;
  }
  return { ok: true, create, update: update.data };
}

function zodErrors(issues: Array<{ path: Array<string | number>; message: string }>): FormErrors {
  const out: FormErrors = {};
  for (const i of issues) {
    const key = i.path.join('.');
    out[key] ||= FRIENDLY.find(([re]) => re.test(key))?.[1] ?? i.message;
  }
  return out;
}

export const SEND_MESSAGE_FROZEN =
  'This freezes the proposal. To change prices you will duplicate it.';
