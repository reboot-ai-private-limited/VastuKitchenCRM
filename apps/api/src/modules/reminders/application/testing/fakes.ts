import type { LeadStatus } from '@vastu/contracts';
import type {
  AdminDirectoryPort,
  ComplaintSourcePort,
  StaleComplaint,
  LeadSnapshot,
  LeadSourcePort,
  NotifierPort,
  OverdueTodo,
  ProposalSourcePort,
  Reminder,
  SentProposal,
  TodoSourcePort,
  Window,
} from '../../domain/ports.js';
import type { ReminderConfig } from '../../domain/reminders.rules.js';

/** In-memory ports for the reminder rules. The sources honour the same window rules as Mongo. */

export class FakeProposalSource implements ProposalSourcePort {
  rows: SentProposal[] = [];
  async findUnseenSent(w: Window) {
    return this.rows
      .filter((p) => p.firstSeenAt === null && p.sentAt < w.before && p.sentAt > w.after)
      .slice(0, w.limit);
  }
  async findSeen(w: Window) {
    return this.rows
      .filter((p) => p.firstSeenAt !== null && p.firstSeenAt < w.before && p.firstSeenAt > w.after)
      .slice(0, w.limit);
  }
}

export class FakeLeadSource implements LeadSourcePort {
  rows: LeadSnapshot[] = [];
  async states(ids: string[]) {
    return this.rows.filter((l) => ids.includes(l.id));
  }
  async findStuck(w: Window & { excludeStatuses: LeadStatus[] }) {
    return this.rows
      .filter(
        (l) =>
          l.statusChangedAt < w.before &&
          l.statusChangedAt > w.after &&
          !['WON', 'LOST', ...w.excludeStatuses].includes(l.status),
      )
      .slice(0, w.limit);
  }
}

/** Delivers once per (userId, dedupeKey), exactly like the Mongo unique index. */
export class FakeNotifier implements NotifierPort {
  delivered: Reminder[] = [];
  private keys = new Set<string>();
  async notify(r: Reminder) {
    const key = `${r.userId}|${r.dedupeKey}`;
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    this.delivered.push(r);
    return true;
  }
  to(userId: string) {
    return this.delivered.filter((d) => d.userId === userId);
  }
}

export class FakeTodoSource implements TodoSourcePort {
  rows: OverdueTodo[] = [];
  async findOverdue(w: { lookbackDays: number; limit: number }) {
    return this.rows.slice(0, w.limit);
  }
}

export class FakeComplaintSource implements ComplaintSourcePort {
  rows: StaleComplaint[] = [];
  async findStale(w: { before: Date; limit: number }) {
    return this.rows.filter((c) => c.activeSince < w.before).slice(0, w.limit);
  }
}

export function staleComplaint(over: Partial<StaleComplaint> = {}): StaleComplaint {
  return {
    id: 'c1',
    projectId: 'proj1',
    projectName: 'Rao Kitchen',
    description: 'Drawer slider is jammed',
    assignedToId: 'tech1',
    reopenCount: 0,
    activeSince: T0,
    ...over,
  };
}

export class FakeAdmins implements AdminDirectoryPort {
  calls = 0;
  ids = ['admin1', 'admin2'];
  async activeAdminIds() {
    this.calls++;
    return this.ids;
  }
}

export const CONFIG: ReminderConfig = {
  unseenDays: 2,
  noActionDays: 2,
  stuckDays: 2,
  stagnantMax: 3,
  complaintDays: 3,
};

export const DAY = 86_400_000;
export const T0 = new Date('2026-11-01T10:00:00Z');
export const at = (days: number) => new Date(T0.getTime() + days * DAY);

export function proposal(over: Partial<SentProposal> = {}): SentProposal {
  return {
    id: 'p1',
    number: 'VK-2026-0001',
    leadId: 'lead1',
    customerName: 'Mrs Rao',
    sentById: 'sales1',
    sentAt: T0,
    firstSeenAt: null,
    ...over,
  };
}

export function lead(over: Partial<LeadSnapshot> = {}): LeadSnapshot {
  return {
    id: 'lead1',
    name: 'Mrs Rao',
    status: 'PROPOSAL_SENT',
    statusChangedAt: T0,
    assignedToId: 'sales1',
    ...over,
  };
}

export function overdueTodo(over: Partial<OverdueTodo> = {}): OverdueTodo {
  return {
    id: 't1',
    title: 'Order the chimney',
    projectId: 'proj1',
    projectName: "Mrs Rao's project",
    dueOn: '2026-10-30',
    assigneeIds: ['tech1', 'designer1'],
    createdById: 'admin1',
    ...over,
  };
}
