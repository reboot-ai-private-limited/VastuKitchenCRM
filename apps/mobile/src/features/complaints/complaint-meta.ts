import type { ComplaintEventType, ComplaintStatus } from '@vastu/contracts';
import type { Tone } from '@/constants/theme';

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
export const STATUS_TONE: Record<ComplaintStatus, Tone> = {
  OPEN: 'danger',
  ASSIGNED: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};
export const STATUS_ORDER: ComplaintStatus[] = ['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED'];

export const EVENT_LABEL: Record<ComplaintEventType, string> = {
  RAISED: 'Complaint raised',
  ASSIGNED: 'Assigned',
  RESOLVED: 'Marked resolved',
  REOPENED: 'Reopened',
  CLOSED: 'Closed',
};
