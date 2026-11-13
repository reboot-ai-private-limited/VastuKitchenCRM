import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadSource,
  type LeadStatus,
  type RoleName,
} from '@vastu/contracts';

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
  VISIT: 'Visit',
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
  /** `me`, `unassigned`, or a user id. */
  assignedTo: string | null;
  stuck: boolean;
  page: number;
  view: 'table' | 'board';
}

export const DEFAULT_FILTERS: LeadFilters = {
  search: '',
  status: null,
  source: null,
  assignedTo: null,
  stuck: false,
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
    assignedTo: params.get('assigned') || null,
    stuck: params.get('stuck') === '1',
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
  if (f.assignedTo) p.set('assigned', f.assignedTo);
  if (f.stuck) p.set('stuck', '1');
  if (f.page > 1) p.set('page', String(f.page));
  if (f.view === 'board') p.set('view', 'board');
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** `https://wa.me/91XXXXXXXXXX`: the API stores 10-digit numbers. */
export const whatsappUrl = (phone: string): string =>
  `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}`;
export const telUrl = (phone: string): string => `tel:+91${phone.replace(/\D/g, '').slice(-10)}`;

/** `98765 43210` for reading; the stored value stays 10 plain digits. */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : phone;
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
