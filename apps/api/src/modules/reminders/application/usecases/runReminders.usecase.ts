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
  TodoSourcePort,
  ComplaintSourcePort,
} from '../../domain/ports.js';

/**
 * The five time rules (docs/03-architecture/notifications-and-cron.md). Safe to run any time and
 * any number of times: every alert carries a dedupeKey, so a repeat delivers nothing new.
 *
 *  1. unseen        — sent, never opened after N days            (once per proposal)
 *  2. no action     — opened N days ago, lead status unchanged   (once per proposal)
 *  3. stagnant      — open lead unchanged for N days             (each N-day window, max M times)
 *  4. to-do overdue — open to-do past its due date               (once per due date)
 *  5. complaint overdue — open/assigned complaint not resolved after N days (once per complaint, again after a reopen)
 *     Stagnant skips PROPOSAL_SENT leads: rules 1 and 2 already cover them.
 *
 * Recipient: the lead's assignee; else the proposal's sender; else every active Admin.
 */
export class RunRemindersUseCase {
  constructor(
    private readonly proposals: ProposalSourcePort,
    private readonly leads: LeadSourcePort,
    private readonly todos: TodoSourcePort,
    private readonly complaints: ComplaintSourcePort,
    private readonly notifier: NotifierPort,
    private readonly admins: AdminDirectoryPort,
    /** Read at the start of EVERY run, so an Admin's change applies to the next one. */
    private readonly loadConfig: () => Promise<ReminderConfig>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<ReminderRunResultDto> {
    const now = this.now();
    const config = await this.loadConfig();
    const result: ReminderRunResultDto = {
      unseen: 0,
      noAction: 0,
      stagnant: 0,
      todoOverdue: 0,
      complaintOverdue: 0,
    };
    const adminIds = lazy(() => this.admins.activeAdminIds());

    result.unseen = await this.unseenProposals(now, config, adminIds);
    result.noAction = await this.noActionProposals(now, config, adminIds);
    result.stagnant = await this.stagnantLeads(now, config, adminIds);
    result.todoOverdue = await this.overdueTodos();
    result.complaintOverdue = await this.overdueComplaints(now, config, adminIds);
    return result;
  }

  // ── rule 1 ───────────────────────────────────────────────────────────────
  private async unseenProposals(
    now: Date,
    config: ReminderConfig,
    adminIds: () => Promise<string[]>,
  ): Promise<number> {
    const proposals = await this.proposals.findUnseenSent({
      before: ago(now, config.unseenDays),
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
  private async noActionProposals(
    now: Date,
    config: ReminderConfig,
    adminIds: () => Promise<string[]>,
  ): Promise<number> {
    const proposals = await this.proposals.findSeen({
      before: ago(now, config.noActionDays),
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
  private async stagnantLeads(
    now: Date,
    config: ReminderConfig,
    adminIds: () => Promise<string[]>,
  ): Promise<number> {
    const { stuckDays, stagnantMax } = config;
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

  // ── rule 4 ───────────────────────────────────────────────────────────────
  /**
   * A to-do past its due date and not done: told to its assignees (or, with none, whoever made it),
   * once per due date — if the due date moves and is missed again, that is a new reminder.
   */
  private async overdueTodos(): Promise<number> {
    const todos = await this.todos.findOverdue({ lookbackDays: LOOKBACK_DAYS, limit: BATCH_LIMIT });

    let created = 0;
    for (const t of todos) {
      created += await this.deliver(t.assigneeIds.length > 0 ? t.assigneeIds : [t.createdById], {
        type: 'TODO_OVERDUE',
        title: 'To-do overdue',
        body: `"${t.title}" in ${t.projectName} was due ${t.dueOn}.`,
        ref: { kind: 'TODO', id: t.id, projectId: t.projectId },
        dedupeKey: `todo-overdue:${t.id}:${t.dueOn}`,
      });
    }
    return created;
  }

  // ── rule 5 ───────────────────────────────────────────────────────────────
  /**
   * A complaint nobody resolved within the allowed days: told to its technician, or to every Admin
   * while it has none. Once per complaint — a reopen starts a new clock and a new reminder.
   */
  private async overdueComplaints(
    now: Date,
    config: ReminderConfig,
    adminIds: () => Promise<string[]>,
  ): Promise<number> {
    const stale = await this.complaints.findStale({
      before: ago(now, config.complaintDays),
      limit: BATCH_LIMIT,
    });

    let created = 0;
    for (const c of stale) {
      created += await this.deliver(await this.recipients(c.assignedToId, adminIds), {
        type: 'COMPLAINT_OVERDUE',
        title: 'Complaint still unresolved',
        body: `${c.projectName}: "${c.description.length > 60 ? `${c.description.slice(0, 59)}…` : c.description}" has been waiting ${describeAge(now.getTime() - c.activeSince.getTime())}.`,
        ref: { kind: 'COMPLAINT', id: c.id, projectId: c.projectId },
        dedupeKey: `complaint-overdue:${c.id}:${c.reopenCount}`,
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
