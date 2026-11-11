import { CLOSED_LEAD_STATUSES, type AttentionBlockDto, type LeadStatus } from '@vastu/contracts';
import { describeAge, statusLabel } from '@/shared/text/labels.js';
import type {
  AlertThresholds,
  ComplaintsSource,
  LeadsSource,
  ProposalsSource,
  TodosSource,
} from '../../domain/ports.js';

/** At most this many are counted, and the oldest few are listed. */
export const ATTENTION_COUNT_CAP = 50;
export const ATTENTION_SHOWN = 10;
const DAY = 86_400_000;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);

const block = (items: AttentionBlockDto['items']): AttentionBlockDto => ({
  total: items.length,
  capped: items.length >= ATTENTION_COUNT_CAP,
  items: items.slice(0, ATTENTION_SHOWN),
});

interface Sources {
  leads: LeadsSource;
  proposals: ProposalsSource;
  complaints: ComplaintsSource;
  todos: TodosSource;
}

const isOpen = (status: LeadStatus) => !CLOSED_LEAD_STATUSES.includes(status);

/**
 * What needs a person right now, worked out live from the same rules and thresholds as the
 * reminders (so the dashboard and the alerts never disagree) — but nothing is sent or recorded.
 */
export class AttentionBuilder {
  constructor(private readonly src: Sources) {}

  async unseenProposals(now: Date, t: AlertThresholds): Promise<AttentionBlockDto> {
    const proposals = await this.src.proposals.findUnseenSent({
      before: ago(now, t.unseenDays),
      after: ago(now, 30),
      limit: ATTENTION_COUNT_CAP,
    });
    const leads = await this.leadMap(proposals.map((p) => p.leadId));
    return block(
      proposals.flatMap((p) => {
        const lead = leads.get(p.leadId);
        if (!lead || !isOpen(lead.status)) return [];
        return [
          {
            title: p.customerName,
            detail: `Proposal ${p.number} sent ${describeAge(now.getTime() - p.sentAt.getTime())} ago, not opened yet`,
            since: p.sentAt.toISOString(),
            ref: { kind: 'PROPOSAL' as const, id: p.id },
          },
        ];
      }),
    );
  }

  async noActionProposals(now: Date, t: AlertThresholds): Promise<AttentionBlockDto> {
    const proposals = await this.src.proposals.findSeen({
      before: ago(now, t.noActionDays),
      after: ago(now, 30),
      limit: ATTENTION_COUNT_CAP,
    });
    const leads = await this.leadMap(proposals.map((p) => p.leadId));
    return block(
      proposals.flatMap((p) => {
        const lead = leads.get(p.leadId);
        if (!lead || !isOpen(lead.status) || !p.firstSeenAt) return [];
        // The status changed after the customer looked: someone already acted.
        if (lead.statusChangedAt.getTime() > p.firstSeenAt.getTime()) return [];
        return [
          {
            title: p.customerName,
            detail: `Opened proposal ${p.number} ${describeAge(now.getTime() - p.firstSeenAt.getTime())} ago, lead is still ${statusLabel(lead.status)}`,
            since: p.firstSeenAt.toISOString(),
            ref: { kind: 'PROPOSAL' as const, id: p.id },
          },
        ];
      }),
    );
  }

  async stagnantLeads(now: Date, t: AlertThresholds): Promise<AttentionBlockDto> {
    const leads = await this.src.leads.findStuckLeads({
      before: ago(now, t.stuckDays),
      after: ago(now, 180),
      // Proposal-sent leads are covered by the two proposal blocks above.
      excludeStatuses: ['PROPOSAL_SENT'],
      limit: ATTENTION_COUNT_CAP,
    });
    return block(
      leads.map((l) => ({
        title: l.name,
        detail: `${statusLabel(l.status)} for ${describeAge(now.getTime() - l.statusChangedAt.getTime())}`,
        since: l.statusChangedAt.toISOString(),
        ref: { kind: 'LEAD' as const, id: l.id },
      })),
    );
  }

  async overdueComplaints(now: Date, t: AlertThresholds): Promise<AttentionBlockDto> {
    const stale = await this.src.complaints.findStale({
      before: ago(now, t.complaintDays),
      limit: ATTENTION_COUNT_CAP,
    });
    return block(
      stale.map((c) => ({
        title: c.projectName,
        detail: `${c.description.length > 70 ? `${c.description.slice(0, 69)}…` : c.description} — waiting ${describeAge(now.getTime() - c.activeSince.getTime())}`,
        since: c.activeSince.toISOString(),
        ref: { kind: 'COMPLAINT' as const, id: c.id, projectId: c.projectId },
      })),
    );
  }

  async overdueTodos(): Promise<AttentionBlockDto> {
    const todos = await this.src.todos.findOverdue({
      lookbackDays: 30,
      limit: ATTENTION_COUNT_CAP,
    });
    return block(
      todos.map((t) => ({
        title: t.title,
        detail: `${t.projectName} — due ${t.dueOn}`,
        since: `${t.dueOn}T00:00:00.000Z`,
        ref: { kind: 'TODO' as const, id: t.id, projectId: t.projectId },
      })),
    );
  }

  private async leadMap(ids: string[]) {
    const unique = [...new Set(ids)];
    return new Map((await this.src.leads.getLeadStates(unique)).map((l) => [l.id, l]));
  }
}
