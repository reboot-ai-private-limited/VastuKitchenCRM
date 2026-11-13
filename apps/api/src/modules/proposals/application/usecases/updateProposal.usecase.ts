import type { UpdateProposalBodyDto } from '@vastu/contracts';
import { AppError } from '@/shared/errors/AppError.js';
import {
  assertNotInPast,
  buildItems,
  computeTotals,
  type Proposal,
  type ProposalPatch,
} from '../../domain/proposal.entity.js';
import type { ActorRef } from '../../domain/leadsGateway.port.js';
import type { ProposalRepositoryPort } from '../../domain/proposal.repository.port.js';
import type { ProposalAccess } from '../services/proposalSupport.js';
import type { TemplateResolver } from '../services/templateResolver.js';

export const ALREADY_SENT =
  'This proposal was already sent and can no longer be changed. Duplicate it to make a new version.';

export class UpdateProposalUseCase {
  constructor(
    private readonly access: ProposalAccess,
    private readonly proposals: ProposalRepositoryPort,
    private readonly templates: TemplateResolver,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: ActorRef, id: string, input: UpdateProposalBodyDto): Promise<Proposal> {
    const current = await this.access.load(id, actor);
    if (current.status !== 'DRAFT') throw AppError.conflict(ALREADY_SENT);
    if (input.validUntil) assertNotInPast(input.validUntil, this.now());

    const patch: ProposalPatch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.terms !== undefined) patch.terms = input.terms;
    if (input.validUntil !== undefined) patch.validUntil = input.validUntil;
    if (input.templateKey !== undefined) {
      const chosen = await this.templates.resolve(input.templateKey);
      patch.templateKey = chosen.key;
      patch.template = chosen.template;
    }
    if (input.siteAddress !== undefined) {
      patch.customer = { ...current.customer, siteAddress: input.siteAddress };
    }

    // Items or discount changed: recompute the totals from the final values of both.
    if (input.items !== undefined || input.discount !== undefined) {
      const items = input.items !== undefined ? buildItems(input.items) : current.items;
      const discount = input.discount ?? current.discount;
      const { subtotal, total } = computeTotals(items, discount);
      Object.assign(patch, { items, discount, subtotal, total });
    }

    // Atomic on status: if it was sent in the meantime this returns null, not a silent overwrite.
    const updated = await this.proposals.updateDraft(id, patch);
    if (!updated) throw AppError.conflict(ALREADY_SENT);
    return updated;
  }
}

export class DeleteProposalUseCase {
  constructor(
    private readonly access: ProposalAccess,
    private readonly proposals: ProposalRepositoryPort,
  ) {}

  async execute(actor: ActorRef, id: string): Promise<void> {
    const current = await this.access.load(id, actor);
    // A draft is private to the team. A sent one is also the customer's: deleting it kills their
    // link, so only an Admin may.
    if (current.status !== 'DRAFT' && actor.role !== 'ADMIN')
      throw AppError.forbidden('Only an Admin can delete a proposal that has been sent.');
    if (!(await this.proposals.deleteById(id))) throw AppError.notFound('Proposal not found.');
  }
}
