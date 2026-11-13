import type { NewProposal, Proposal, ProposalPatch, WhatsappSend } from './proposal.entity.js';
import type { ProposalStatus } from '@vastu/contracts';

export interface ReminderWindow {
  before: Date;
  after: Date;
  limit: number;
}

export interface ProposalListFilter {
  page: number;
  pageSize: number;
  leadId?: string | undefined;
  status?: ProposalStatus | undefined;
  createdById?: string | undefined;
}

export interface ProposalRepositoryPort {
  create(proposal: NewProposal): Promise<Proposal>;
  findById(id: string): Promise<Proposal | null>;
  findByToken(token: string): Promise<Proposal | null>;
  /** Changes a DRAFT only. Null when the proposal is missing or already sent. */
  updateDraft(id: string, patch: ProposalPatch): Promise<Proposal | null>;
  /** Deletes a DRAFT only. False when missing or already sent. */
  /** Removes the proposal in any status; its public link stops working with it. */
  deleteById(id: string): Promise<boolean>;
  /** DRAFT → SENT, atomically. Null when missing or already sent. */
  markSent(id: string, sentAt: Date, sentById: string): Promise<Proposal | null>;
  /** Appends a WhatsApp send record to a SENT proposal. Null when it does not exist. */
  recordWhatsappSend(id: string, send: WhatsappSend): Promise<Proposal | null>;
  /**
   * Counts a view of a SENT proposal. `first` is true only for the very first view, even when
   * several browsers open it at once. Null when the token is unknown or the proposal is a draft.
   */
  recordSeen(token: string, at: Date): Promise<{ proposal: Proposal; first: boolean } | null>;
  /**
   * SENT proposals never opened whose `sentAt` is in `(after, before)`. Oldest first, at most `limit`.
   * Bounded on both sides so reminder runs stay small however old the data gets.
   */
  findUnseenSent(query: ReminderWindow): Promise<Proposal[]>;
  /** SENT proposals whose `firstSeenAt` is in `(after, before)`. Oldest first, at most `limit`. */
  findSeen(query: ReminderWindow): Promise<Proposal[]>;
  /** The most recently SENT proposal of a lead, or null. (Its total seeds a new project's value.) */
  findLatestSentByLead(leadId: string): Promise<Proposal | null>;
  list(filter: ProposalListFilter): Promise<{ items: Proposal[]; total: number }>;
}
