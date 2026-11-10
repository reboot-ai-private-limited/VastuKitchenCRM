import type { NewProposal, Proposal, ProposalPatch } from './proposal.entity.js';
import type { ProposalStatus } from '@vastu/contracts';

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
  deleteDraft(id: string): Promise<boolean>;
  /** DRAFT → SENT, atomically. Null when missing or already sent. */
  markSent(id: string, sentAt: Date, sentById: string): Promise<Proposal | null>;
  /**
   * Counts a view of a SENT proposal. `first` is true only for the very first view, even when
   * several browsers open it at once. Null when the token is unknown or the proposal is a draft.
   */
  recordSeen(token: string, at: Date): Promise<{ proposal: Proposal; first: boolean } | null>;
  list(filter: ProposalListFilter): Promise<{ items: Proposal[]; total: number }>;
}
