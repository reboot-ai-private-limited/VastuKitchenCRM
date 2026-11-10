import { AppError } from '@/shared/errors/AppError.js';
import type { ProposalSeenEvent } from '@/shared/events/appEvents.js';
import type { ActorRef, LeadInfo, LeadsGatewayPort } from '../../domain/leadsGateway.port.js';
import type { NumberSequencePort } from '../../domain/numberSequence.port.js';
import type { NewProposal, Proposal, ProposalPatch } from '../../domain/proposal.entity.js';
import type { ProposalEventsPort } from '../../domain/proposalEvents.port.js';
import type {
  ProposalListFilter,
  ProposalRepositoryPort,
} from '../../domain/proposal.repository.port.js';
import type { PublicTokenPort } from '../../domain/publicToken.port.js';
import type { DirectoryUser, UserDirectoryPort } from '../../domain/userDirectory.port.js';
import { ProposalAccess, ProposalLinks, ProposalViewBuilder } from '../services/proposalSupport.js';

/** In-memory ports for use-case tests. They honour the same contracts as the Mongo adapters. */

export class FakeProposals implements ProposalRepositoryPort {
  rows: Proposal[] = [];
  lastFilter: ProposalListFilter | undefined;
  private seq = 0;
  async create(p: NewProposal) {
    const created: Proposal = { ...p, id: `p${++this.seq}`, createdAt: new Date() };
    this.rows.push(created);
    return created;
  }
  async findById(id: string) {
    return this.rows.find((p) => p.id === id) ?? null;
  }
  async findByToken(token: string) {
    return this.rows.find((p) => p.token === token) ?? null;
  }
  async updateDraft(id: string, patch: ProposalPatch) {
    const p = this.rows.find((x) => x.id === id && x.status === 'DRAFT');
    if (!p) return null;
    Object.assign(p, patch);
    return p;
  }
  async deleteDraft(id: string) {
    const i = this.rows.findIndex((x) => x.id === id && x.status === 'DRAFT');
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
  async markSent(id: string, sentAt: Date, sentById: string) {
    const p = this.rows.find((x) => x.id === id && x.status === 'DRAFT');
    if (!p) return null;
    Object.assign(p, { status: 'SENT', sentAt, sentById });
    return p;
  }
  async recordSeen(token: string, at: Date) {
    const p = this.rows.find((x) => x.token === token && x.status === 'SENT');
    if (!p) return null;
    const first = p.firstSeenAt === null;
    if (first) p.firstSeenAt = at;
    p.lastSeenAt = at;
    p.seenCount++;
    return { proposal: p, first };
  }
  async list(filter: ProposalListFilter) {
    this.lastFilter = filter;
    const items = this.rows.filter(
      (p) =>
        (!filter.leadId || p.leadId === filter.leadId) &&
        (!filter.createdById || p.createdById === filter.createdById),
    );
    return { items, total: items.length };
  }
}

export class FakeNumbers implements NumberSequencePort {
  private seqs = new Map<number, number>();
  async next(year: number) {
    const n = (this.seqs.get(year) ?? 0) + 1;
    this.seqs.set(year, n);
    return n;
  }
}

export class FakeTokens implements PublicTokenPort {
  private n = 0;
  generate() {
    return `token-${++this.n}-xxxxxxxxxxxxxxxx`;
  }
}

/** Mimics the leads contract: a lead is visible to its owner and to ADMIN, otherwise NOT FOUND. */
export class FakeGateway implements LeadsGatewayPort {
  leads: Array<LeadInfo & { assignedToId: string | null }> = [
    {
      id: 'lead1',
      name: 'Mrs Rao Devi',
      phone: '9876500001',
      city: 'Siliguri',
      assignedToId: 'sales1',
    },
  ];
  sent: Array<{ leadId: string; number: string; by: string }> = [];
  seen: Array<{ leadId: string; number: string }> = [];
  async getLead(actor: ActorRef, leadId: string) {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead || (actor.role !== 'ADMIN' && lead.assignedToId !== actor.id)) {
      throw AppError.notFound('Lead not found.');
    }
    return { id: lead.id, name: lead.name, phone: lead.phone, city: lead.city };
  }
  async recordSent(actor: ActorRef, leadId: string, number: string) {
    this.sent.push({ leadId, number, by: actor.id });
  }
  async recordSeen(leadId: string, number: string) {
    this.seen.push({ leadId, number });
  }
}

export class FakeDirectory implements UserDirectoryPort {
  users: DirectoryUser[] = [
    { id: 'sales1', name: 'Ravi' },
    { id: 'admin1', name: 'Owner' },
  ];
  async find(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id));
  }
}

export class FakeEvents implements ProposalEventsPort {
  seen: ProposalSeenEvent[] = [];
  proposalSeen(e: ProposalSeenEvent) {
    this.seen.push(e);
  }
}

export const sales1: ActorRef = { id: 'sales1', role: 'SALES' };
export const sales2: ActorRef = { id: 'sales2', role: 'SALES' };
export const admin: ActorRef = { id: 'admin1', role: 'ADMIN' };

export function world(now: () => Date = () => new Date('2026-11-10T10:00:00Z')) {
  const proposals = new FakeProposals();
  const gateway = new FakeGateway();
  const directory = new FakeDirectory();
  const events = new FakeEvents();
  const numbers = new FakeNumbers();
  const tokens = new FakeTokens();
  const links = new ProposalLinks('https://admin.example.com/', 'Vaastu Kitchen');
  const access = new ProposalAccess(proposals, gateway);
  const views = new ProposalViewBuilder(directory, links);
  return { proposals, gateway, directory, events, numbers, tokens, links, access, views, now };
}

export const item = (over = {}) => ({
  title: 'L-shaped kitchen',
  quantity: 1,
  unitPrice: 450_000,
  ...over,
});
