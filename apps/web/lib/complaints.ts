import {
  COMPLAINT_STATUSES,
  type ComplaintEventDto,
  type ComplaintStatus,
  type RoleName,
} from '@vastu/contracts';

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export interface ComplaintFilters {
  status: ComplaintStatus | null;
  mine: boolean;
  projectId: string | null;
  page: number;
}

export const DEFAULT_COMPLAINT_FILTERS: ComplaintFilters = {
  status: null,
  mine: false,
  projectId: null,
  page: 1,
};

export function parseComplaintFilters(params: {
  get(name: string): string | null;
}): ComplaintFilters {
  const status = params.get('status');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    status: (COMPLAINT_STATUSES as readonly string[]).includes(status ?? '')
      ? (status as ComplaintStatus)
      : null,
    mine: params.get('mine') === '1',
    projectId: params.get('project') || null,
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

export function complaintFiltersToSearch(f: ComplaintFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (f.mine) p.set('mine', '1');
  if (f.projectId) p.set('project', f.projectId);
  if (f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Technicians and HR cannot raise complaints (docs/02-product/complaints.md). The API refuses the rest. */
export const canRaiseComplaint = (role: RoleName | undefined): boolean =>
  role === 'ADMIN' ||
  role === 'OFFICE' ||
  role === 'SALES' ||
  role === 'DESIGNER' ||
  role === 'CUSTOMER';

export function snippet(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/** One history line in words. */
export function describeComplaintEvent(e: ComplaintEventDto): {
  title: string;
  note: string | null;
} {
  const who = e.actor?.name ?? 'Someone';
  switch (e.type) {
    case 'RAISED':
      return { title: `Raised by ${who}`, note: null };
    case 'ASSIGNED':
      return { title: e.assignee ? `Assigned to ${e.assignee.name}` : 'Assigned', note: null };
    case 'RESOLVED':
      return { title: `Resolved by ${who}`, note: e.note };
    case 'REOPENED':
      return { title: `Reopened by ${who}`, note: e.note ? `Reason: ${e.note}` : null };
    case 'CLOSED':
      return { title: `Closed by ${who}`, note: e.note };
  }
}

export const STALE_MESSAGE = 'Someone else just updated this. Showing the latest.';
