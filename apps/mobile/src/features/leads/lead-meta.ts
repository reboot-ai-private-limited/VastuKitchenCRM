import type { LeadStatus } from '@vastu/contracts';
import type { Tone } from '@/constants/theme';

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  VISIT: 'Visit',
  PROPOSAL_SENT: 'Proposal sent',
  FOLLOW_UP: 'Follow up',
  WON: 'Won',
  LOST: 'Lost',
};

export const STATUS_TONE: Record<LeadStatus, Tone> = {
  NEW: 'info',
  CONTACTED: 'neutral',
  VISIT: 'violet',
  PROPOSAL_SENT: 'orange',
  FOLLOW_UP: 'warning',
  WON: 'success',
  LOST: 'danger',
};

export const STATUS_ORDER = Object.keys(STATUS_LABEL) as LeadStatus[];
