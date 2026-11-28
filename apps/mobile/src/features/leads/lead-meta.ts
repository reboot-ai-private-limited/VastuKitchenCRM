import type { LeadActivityDto, LeadProductOfInterest, LeadSource, LeadStatus } from '@vastu/contracts';
import type { StageTone, Tone } from '@/constants/theme';

export const PRODUCT_LABEL: Record<LeadProductOfInterest, string> = {
  MODULAR_KITCHEN: 'Modular kitchen',
  WARDROBE: 'Wardrobe',
  TV_UNIT: 'TV unit',
  STORAGE_CROCKERY: 'Storage / Crockery',
  VANITY_BATHROOM: 'Vanity / Bathroom',
  FULL_HOME_INTERIOR: 'Full home interior',
  APPLIANCES_HARDWARE: 'Appliances / Hardware',
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
  FOLLOW_UP: 'Follow up',
  WON: 'Won',
  LOST: 'Lost',
};

export const STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: 'info',
  CONTACTED: 'neutral',
  INVALID_DATA: 'neutral',
  BROCHURE_SENT: 'accent',
  VISIT: 'violet',
  MEASUREMENT_SCHEDULED: 'violet',
  MEASUREMENT_DONE: 'accent',
  DESIGN_ESTIMATE_SCHEDULED: 'violet',
  DESIGN_ESTIMATE_DONE: 'accent',
  PROPOSAL_SENT: 'orange',
  FOLLOW_UP: 'warning',
  WON: 'success',
  LOST: 'neutral',
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  WALK_IN: 'Walk-in',
  WEBSITE: 'Website',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  JUSTDIAL: 'Justdial',
  REFERRAL: 'Referral',
  EXISTING_CUSTOMER: 'Existing customer',
  OTHER: 'Other',
};

/** Badge colour on the Leads list: grouped by where the lead is in the pipeline. */
export const STAGE_TONE: Record<LeadStatus, StageTone> = {
  NEW: 'neutral',
  CONTACTED: 'contact',
  INVALID_DATA: 'closed',
  BROCHURE_SENT: 'contact',
  VISIT: 'site',
  MEASUREMENT_SCHEDULED: 'site',
  MEASUREMENT_DONE: 'site',
  DESIGN_ESTIMATE_SCHEDULED: 'site',
  DESIGN_ESTIMATE_DONE: 'site',
  PROPOSAL_SENT: 'proposal',
  FOLLOW_UP: 'proposal',
  WON: 'won',
  LOST: 'closed',
};

export const STATUS_ORDER = Object.keys(STATUS_LABEL) as LeadStatus[];

export function daysInStage(statusChangedAt: string): number | null {
  const ms = Date.parse(statusChangedAt);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

export const OUTCOME_LABEL: Record<string, string> = {
  INTERESTED: 'Interested',
  CALL_BACK: 'Call back',
  NOT_INTERESTED: 'Not interested',
  NO_ANSWER: 'No answer',
  WRONG_NUMBER: 'Wrong number',
};

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const stat = (v: unknown): string =>
  typeof v === 'string' && v in STATUS_LABEL ? STATUS_LABEL[v as LeadStatus] : String(v ?? '?');

export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** One timeline entry as a headline plus an optional detail line (the API's `data` is loosely typed). */
export function describeActivity(a: LeadActivityDto): { title: string; detail?: string } {
  const d = a.data;
  const who = a.by?.name;
  const join = (...p: (string | null | undefined | false)[]) => p.filter(Boolean).join(' · ') || undefined;
  switch (a.type) {
    case 'CREATED':
      return { title: who ? `Lead added by ${who}` : 'Lead added', detail: str(d['source']) ? `Source: ${str(d['source'])}` : undefined };
    case 'ASSIGNED': {
      const to = str(d['toName']);
      return { title: to ? `Assigned to ${to}` : 'Unassigned', detail: who ? `By ${who}` : undefined };
    }
    case 'STATUS_CHANGED':
      return {
        title: `${stat(d['from'])} to ${stat(d['to'])}`,
        detail: join(who && `By ${who}`, str(d['lostReason']) && `Reason: ${str(d['lostReason'])}`, str(d['note'])),
      };
    case 'CALL': {
      const sec = typeof d['durationSec'] === 'number' ? d['durationSec'] : 0;
      const outcome = str(d['outcome']);
      return {
        title: d['answered'] === true ? `Call answered (${formatDuration(sec)})` : 'Call not answered',
        detail: join(who && `By ${who}`, outcome && OUTCOME_LABEL[outcome]),
      };
    }
    case 'VISIT':
      return { title: 'Site visit', detail: join(who && `By ${who}`, str(d['note'])) };
    case 'DESIGN_COMPLETED': {
      const count = typeof d['mediaCount'] === 'number' ? d['mediaCount'] : 0;
      const files = count > 0 ? `${count} ${count === 1 ? 'file' : 'files'}` : null;
      return { title: 'Design completed', detail: join(who && `By ${who}`, files, str(d['note'])) };
    }
    case 'PROPOSAL_SENT':
      return { title: `Proposal ${str(d['number']) ?? ''} sent`.replace('  ', ' '), detail: who ? `By ${who}` : undefined };
    case 'PROPOSAL_SEEN':
      return { title: `Customer opened proposal ${str(d['number']) ?? ''}`.trim() };
    case 'PROJECT_CREATED':
      return { title: `Project created${str(d['projectName']) ? `: ${str(d['projectName'])}` : ''}` };
    case 'PROJECT_CLOSED':
      return { title: `Project closed${str(d['projectName']) ? `: ${str(d['projectName'])}` : ''}` };
  }
}
