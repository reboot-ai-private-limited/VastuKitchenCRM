import type { ReminderRunResultDto } from '@vastu/contracts';
import {
  BATCH_LIMIT,
  DAY_MS,
  LOOKBACK_DAYS,
  describeAge,
  isClosed,
  stagnantWindow,
  statusLabel,
  type ReminderConfig,
} from '../../domain/reminders.rules.js';
import type {
  AdminDirectoryPort,
  LeadSnapshot,
  LeadSourcePort,
  NotifierPort,
  ProposalSourcePort,
  Reminder,
} from '../../domain/ports.js';

/**
 * The three time rules (docs/03-architecture/notifications-and-cron.md). Safe to run any time and
 * any number of times: every alert carries a dedupeKey, so a repeat delivers nothing new.
 *
 *  1. unseen        — sent, never opened after N days            (once per proposal)
 *  2. no action     — opened N days ago, lead status unchanged   (once per proposal)
 *  3. stagnant      — open lead unchanged for N days             (each N-day window, max M times)
 *     Stagnant skips PROPOSAL_SENT leads: rules 1 and 2 already cover them.
 *
 * Recipient: the lead's assignee; else the proposal's sender; else every active Admin.
 */
export class RunRemindersUseCase {
  constructor(
    private readonly proposals: ProposalSourcePort,
    private readonly leads: LeadSourcePort,
    private readonly notifier: NotifierPort,
    private readonly admins: AdminDirectoryPort,
    private readonly config: ReminderConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<ReminderRunResultDto> {
    const now = this.now();
    const result: ReminderRunResultDto = { unseen: 0, noAction: 0, stagnant: 0 };
    const adminIds = lazy(() => this.admins.activeAdminIds());

    result.unseen = await this.unseenProposals(now, adminIds);
    result.noAction = await this.noActionProposals(now, adminIds);
    result.stagnant = await this.stagnantLeads(now, adminIds);
    return result;
  }

  // ── rule 1 ───────────────────────────────────────────────────────────────
  private async unseenProposals(now: Date, adminIds: () => Promise<string[]>): Promise<number> {
    const proposals = await this.proposals.findUnseenSent({
      before: ago(now, this.config.unseenDays),
      after: ago(now, LOOKBACK_DAYS),
      limit: BATCH_LIMIT,
    });
    const leads = await this.leadMap(proposals.map((p) => p.leadId));

    let created = 0;
    for (const p of proposals) {
      const lead = leads.get(p.leadId);
      if (!lead || isClosed(lead.status)) continue;
      created += await this.deliver(
        await this.recipients(lead.assignedToId ?? p.sentById, adminIds),
        {
          type: 'PROPOSAL_UNSEEN',
          title: 'Proposal not opened yet',
          body: `${p.customerName} has not opened proposal ${p.number} (sent ${describeAge(now.getTime() - p.sentAt.getTime())} ago). Follow up?`,
          ref: { kind: 'PROPOSAL', id: p.id },
          dedupeKey: `proposal-unseen:${p.id}`,
        },
      );
    }
    return created;
  }

  // ── rule 2 ───────────────────────────────────────────────────────────────
  private async noActionProposals(now: Date, adminIds: () => Promise<string[]>): Promise<number> {
    const proposals = await this.proposals.findSeen({
      before: ago(now, this.config.noActionDays),
      after: ago(now, LOOKBACK_DAYS),
      limit: BATCH_LIMIT,
    });
    const leads = await this.leadMap(proposals.map((p) => p.leadId));

    let created = 0;
    for (const p of proposals) {
      const lead = leads.get(p.leadId);
      if (!lead || isClosed(lead.status) || p.firstSeenAt === null) continue;
      // The status changed after the customer looked: someone already acted.
      if (lead.statusChangedAt.getTime() > p.firstSeenAt.getTime()) continue;

      created += await this.deliver(
        await this.recipients(lead.assignedToId ?? p.sentById, adminIds),
        {
          type: 'PROPOSAL_NO_ACTION',
          title: 'Proposal seen, no action yet',
          body: `${p.customerName} opened proposal ${p.number} ${describeAge(now.getTime() - p.firstSeenAt.getTime())} ago, but the lead is still in ${statusLabel(lead.status)}.`,
          ref: { kind: 'PROPOSAL', id: p.id },
          dedupeKey: `proposal-no-action:${p.id}`,
        },
      );
    }
    return created;
  }

  // ── rule 3 ───────────────────────────────────────────────────────────────
  private async stagnantLeads(now: Date, adminIds: () => Promise<string[]>): Promise<number> {
    const { stuckDays, stagnantMax } = this.config;
    const stuckMs = stuckDays * DAY_MS;
    const leads = await this.leads.findStuck({
      before: ago(now, stuckDays),
      // Past the last allowed window nothing more is sent, so those leads are not even loaded.
      after: new Date(now.getTime() - (stagnantMax + 1) * stuckMs),
      excludeStatuses: ['PROPOSAL_SENT'],
      limit: BATCH_LIMIT,
    });

    let created = 0;
    for (const lead of leads) {
      const window = stagnantWindow(lead.statusChangedAt, now, stuckMs);
      if (window < 1 || window > stagnantMax) continue;
      created += await this.deliver(await this.recipients(lead.assignedToId, adminIds), {
        type: 'LEAD_STAGNANT',
        title: 'Lead needs attention',
        body: `${lead.name} has been in ${statusLabel(lead.status)} for ${describeAge(now.getTime() - lead.statusChangedAt.getTime())}.`,
        ref: { kind: 'LEAD', id: lead.id },
        // One per stuck period AND window: a status change starts a new period, so it can fire again.
        dedupeKey: `lead-stagnant:${lead.id}:${lead.statusChangedAt.getTime()}:${window}`,
      });
    }
    return created;
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  private async leadMap(ids: string[]): Promise<Map<string, LeadSnapshot>> {
    const unique = [...new Set(ids)];
    return new Map((await this.leads.states(unique)).map((l) => [l.id, l]));
  }

  /** The assignee (or the fallback person) if there is one; otherwise every active Admin. */
  private async recipients(
    preferred: string | null,
    adminIds: () => Promise<string[]>,
  ): Promise<string[]> {
    return preferred ? [preferred] : adminIds();
  }

  /** Delivers to each recipient; returns how many were new (not already delivered). */
  private async deliver(userIds: string[], reminder: Omit<Reminder, 'userId'>): Promise<number> {
    let created = 0;
    for (const userId of userIds) {
      if (await this.notifier.notify({ ...reminder, userId })) created++;
    }
    return created;
  }
}

const ago = (now: Date, days: number): Date => new Date(now.getTime() - days * DAY_MS);

/** Runs `load` at most once, and only if someone actually asks. */
function lazy<T>(load: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;
  return () => (cached ??= load());
}
