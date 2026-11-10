import type { CallOutcome } from '@vastu/contracts';

export interface CallRecord {
  id: string;
  leadId: string;
  userId: string;
  startedAt: Date;
  durationSec: number;
  answered: boolean;
  outcome: CallOutcome | null;
  note: string | null;
}

export type NewCallRecord = Omit<CallRecord, 'id'>;

/** One employee's call numbers over a window — the performance figures. */
export interface CallStat {
  userId: string;
  calls: number;
  answered: number;
  talkSeconds: number;
}
