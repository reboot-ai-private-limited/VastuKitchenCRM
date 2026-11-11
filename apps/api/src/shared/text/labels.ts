import type { LeadStatus } from '@vastu/contracts';

const LEAD_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  VISIT: 'Visit',
  PROPOSAL_SENT: 'Proposal Sent',
  FOLLOW_UP: 'Follow-up',
  WON: 'Won',
  LOST: 'Lost',
};
export const statusLabel = (status: LeadStatus): string => LEAD_LABELS[status];

/** "5 minutes", "3 hours", "2 days" — whatever reads naturally for the span. */
export function describeAge(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}
