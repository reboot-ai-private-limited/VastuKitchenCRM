import {
  LEAD_PRODUCTS_OF_INTEREST,
  LEAD_SOURCES,
  LEAD_STATUSES,
  formatDisplayPhone,
  toE164Phone,
  toWaDigits,
  type LeadProductOfInterest,
  type LeadSource,
  type LeadStatus,
  type RoleName,
} from '@vastu/contracts';

export const PRODUCT_OF_INTEREST_LABEL: Record<LeadProductOfInterest, string> = {
  MODULAR_KITCHEN: 'Modular Kitchen',
  WARDROBE: 'Wardrobe',
  TV_UNIT: 'TV Unit',
  STORAGE_CROCKERY: 'Storage / Crockery Unit',
  VANITY_BATHROOM: 'Vanity / Bathroom',
  FULL_HOME_INTERIOR: 'Full Home Interior',
  APPLIANCES_HARDWARE: 'Appliances / Hardware',
  OTHER: 'Other',
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  WEBSITE: 'Website',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  JUSTDIAL: 'Justdial',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  EXISTING_CUSTOMER: 'Existing customer',
  OTHER: 'Other',
};

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INVALID_DATA: 'Invalid data',
  BROCHURE_SENT: 'Brochure sent',
  VISIT: 'Visit',
  MEASUREMENT_SCHEDULED: 'Measurement scheduled',
  MEASUREMENT_DONE: 'Measurement done',
  DESIGN_ESTIMATE_SCHEDULED: 'Design estimate scheduled',
  DESIGN_ESTIMATE_DONE: 'Design estimate done',
  PROPOSAL_SENT: 'Proposal sent',
  FOLLOW_UP: 'Follow-up',
  WON: 'Won',
  LOST: 'Lost',
};

/** What the signed-in role may do on leads. Cosmetic: the API is the real gate. */
export function leadPermissions(role: RoleName | undefined) {
  return {
    add: role === 'ADMIN' || role === 'SALES' || role === 'OFFICE',
    edit: role === 'ADMIN' || role === 'SALES',
    changeStatus: role === 'ADMIN' || role === 'SALES',
    assign: role === 'ADMIN',
    /** Office has no access to proposals. */
    sendProposal: role === 'ADMIN' || role === 'SALES',
    filterByAssignee: role === 'ADMIN',
    /** Sales only see their own leads, so the "assigned to" filter makes no sense for them. */
    importCsv: role === 'ADMIN' || role === 'OFFICE',
  };
}

export interface LeadFilters {
  search: string;
  status: LeadStatus | null;
  source: LeadSource | null;
  product: LeadProductOfInterest | null;
  /** `me`, `unassigned`, or a user id. */
  assignedTo: string | null;
  stuck: boolean;
  showLost: boolean;
  page: number;
  view: 'table' | 'board';
}

export const DEFAULT_FILTERS: LeadFilters = {
  search: '',
  status: null,
  source: null,
  product: null,
  assignedTo: null,
  stuck: false,
  showLost: false,
  page: 1,
  view: 'table',
};

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v && (list as readonly string[]).includes(v) ? (v as T) : null;

/** URL → filters. Anything unrecognised falls back to the default, so a hand-edited URL never breaks the page. */
export function parseFilters(params: { get(name: string): string | null }): LeadFilters {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    search: (params.get('q') ?? '').trim(),
    status: oneOf(LEAD_STATUSES, params.get('status')),
    source: oneOf(LEAD_SOURCES, params.get('source')),
    product: oneOf(LEAD_PRODUCTS_OF_INTEREST, params.get('product')),
    assignedTo: params.get('assigned') || null,
    stuck: params.get('stuck') === '1',
    showLost: params.get('lost') === '1',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    view: params.get('view') === 'board' ? 'board' : 'table',
  };
}

/** Filters → query string (defaults omitted, so the plain list has a clean `/leads` URL). */
export function filtersToSearch(f: LeadFilters): string {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.status) p.set('status', f.status);
  if (f.source) p.set('source', f.source);
  if (f.product) p.set('product', f.product);
  if (f.assignedTo) p.set('assigned', f.assignedTo);
  if (f.stuck) p.set('stuck', '1');
  if (f.showLost) p.set('lost', '1');
  if (f.page > 1) p.set('page', String(f.page));
  if (f.view === 'board') p.set('view', 'board');
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** `https://wa.me/<country><local>`: supports India (+91), Bhutan (+975), Nepal (+977). */
export const whatsappUrl = (phone: string): string => `https://wa.me/${toWaDigits(phone)}`;
export const telUrl = (phone: string): string => `tel:${toE164Phone(phone)}`;

/** `98765 43210` for India; `+975 1712 3456` / `+977 98412 34567` for Bhutan & Nepal. */
export function formatPhone(phone: string): string {
  return formatDisplayPhone(phone);
}

/** The row's inline actions, in order: what this person may do to this lead. */
export function leadRowActions(
  can: ReturnType<typeof leadPermissions>,
  status: LeadStatus,
): Array<'status' | 'assign' | 'proposal'> {
  return [
    ...(can.changeStatus && status !== 'WON' ? (['status'] as const) : []),
    ...(can.assign ? (['assign'] as const) : []),
    ...(can.sendProposal ? (['proposal'] as const) : []),
  ];
}
