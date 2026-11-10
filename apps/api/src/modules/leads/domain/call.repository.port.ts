import type { CallRecord, CallStat, NewCallRecord } from './call.entity.js';

export interface CallRepositoryPort {
  /**
   * Idempotent on (leadId, userId, startedAt): recording the same call twice returns the stored
   * one with `created: false`, so an app retrying after a dropped connection cannot double-count.
   */
  record(call: NewCallRecord): Promise<{ call: CallRecord; created: boolean }>;
  listByLead(leadId: string): Promise<CallRecord[]>;
  /** Calls with `from <= startedAt < to`, grouped by employee. */
  statsByUser(from: Date, to: Date): Promise<CallStat[]>;
}
