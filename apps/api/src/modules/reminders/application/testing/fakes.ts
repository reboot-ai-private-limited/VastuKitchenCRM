import type { LeadStatus } from '@vastu/contracts';
import type {
  AdminDirectoryPort,
  LeadSnapshot,
  LeadSourcePort,
  NotifierPort,
  ProposalSourcePort,
  Reminder,
  SentProposal,
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
