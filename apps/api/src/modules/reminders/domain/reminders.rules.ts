import { CLOSED_LEAD_STATUSES, type LeadStatus } from '@vastu/contracts';

export const DAY_MS = 86_400_000;
/** Only recent items are considered, so a run stays small however old the data gets. */
export const LOOKBACK_DAYS = 30;
/** At most this many items per rule per run. */
export const BATCH_LIMIT = 500;

export interface ReminderConfig {
  /** A sent proposal never opened after this many days → "unseen". */
  unseenDays: number;
  /** A proposal opened this many days ago with no status change since → "no action". */
  noActionDays: number;
  /** A lead unchanged this long is stuck; stagnant reminders repeat at this interval. */
  stuckDays: number;
  /** Stagnant reminders per stuck period, at most. */
  stagnantMax: number;
}

export const isClosed = (status: LeadStatus): boolean => CLOSED_LEAD_STATUSES.includes(status);

/** Which stagnant window a lead is in: 1 after the first `stuckMs`, 2 after the second, … */
export function stagnantWindow(statusChangedAt: Date, now: Date, stuckMs: number): number {
  return Math.floor((now.getTime() - statusChangedAt.getTime()) / stuckMs);
}

const LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  VISIT: 'Visit',
  PROPOSAL_SENT: 'Proposal Sent',
  FOLLOW_UP: 'Follow-up',
  WON: 'Won',
  LOST: 'Lost',
};
export const statusLabel = (status: LeadStatus): string => LABELS[status];

/** "5 minutes", "3 hours", "2 days" — whatever reads naturally for the span. */
export function describeAge(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}
