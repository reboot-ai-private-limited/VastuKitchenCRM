import { isValidObjectId, type HydratedDocument } from 'mongoose';
import type { NewProposal, Proposal, ProposalPatch } from '../domain/proposal.entity.js';
import type {
  ProposalListFilter,
  ProposalRepositoryPort,
  ReminderWindow,
} from '../domain/proposal.repository.port.js';
import { ProposalModel, type ProposalDoc } from './proposal.schema.js';

function toEntity(doc: HydratedDocument<ProposalDoc>): Proposal {
  return {
    id: doc.id as string,
    number: doc.number,
    leadId: doc.leadId.toString(),
    status: doc.status,
    customer: {
      name: doc.customer.name,
      phone: doc.customer.phone,
      city: doc.customer.city,
      siteAddress: doc.customer.siteAddress,
    },
    title: doc.title,
    items: doc.items.map((i) => ({
      title: i.title,
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: doc.subtotal,
    discount: doc.discount,
    total: doc.total,
    notes: doc.notes,
    terms: doc.terms,
    validUntil: doc.validUntil,
    token: doc.token,
    sentAt: doc.sentAt,
    sentById: doc.sentById ? doc.sentById.toString() : null,
    firstSeenAt: doc.firstSeenAt,
    lastSeenAt: doc.lastSeenAt,
    seenCount: doc.seenCount,
    createdById: doc.createdById.toString(),
    createdAt: doc.createdAt,
  };
}

export class MongoProposalRepository implements ProposalRepositoryPort {
  async create(proposal: NewProposal): Promise<Proposal> {
    return toEntity(await ProposalModel.create(proposal));
  }

  async findById(id: string): Promise<Proposal | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ProposalModel.findById(id);
    return doc ? toEntity(doc) : null;
  }

  async findByToken(token: string): Promise<Proposal | null> {
    const doc = await ProposalModel.findOne({ token });
    return doc ? toEntity(doc) : null;
  }

  async updateDraft(id: string, patch: ProposalPatch): Promise<Proposal | null> {
    if (!isValidObjectId(id)) return null;
    // `status: 'DRAFT'` in the filter makes "still a draft" part of the write itself.
    const doc = await ProposalModel.findOneAndUpdate(
      { _id: id, status: 'DRAFT' },
      { $set: patch },
      { new: true },
    );
    return doc ? toEntity(doc) : null;
  }

  async deleteDraft(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await ProposalModel.deleteOne({ _id: id, status: 'DRAFT' });
    return res.deletedCount === 1;
  }

  async markSent(id: string, sentAt: Date, sentById: string): Promise<Proposal | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ProposalModel.findOneAndUpdate(
      { _id: id, status: 'DRAFT' },
      { $set: { status: 'SENT', sentAt, sentById } },
      { new: true },
    );
    return doc ? toEntity(doc) : null;
  }

  async recordSeen(
    token: string,
    at: Date,
  ): Promise<{ proposal: Proposal; first: boolean } | null> {
    // Step 1: only the request that finds `firstSeenAt` still empty can claim "first".
    const firstClaim = await ProposalModel.findOneAndUpdate(
      { token, status: 'SENT', firstSeenAt: null },
      { $set: { firstSeenAt: at, lastSeenAt: at }, $inc: { seenCount: 1 } },
      { new: true },
    );
    if (firstClaim) return { proposal: toEntity(firstClaim), first: true };

    // Step 2: any later view.
    const later = await ProposalModel.findOneAndUpdate(
      { token, status: 'SENT' },
      { $set: { lastSeenAt: at }, $inc: { seenCount: 1 } },
      { new: true },
    );
    return later ? { proposal: toEntity(later), first: false } : null;
  }

  async findUnseenSent(q: ReminderWindow): Promise<Proposal[]> {
    const docs = await ProposalModel.find({
      status: 'SENT',
      firstSeenAt: null,
      sentAt: { $lt: q.before, $gt: q.after },
    })
      .sort({ sentAt: 1 })
      .limit(q.limit);
    return docs.map(toEntity);
  }

  async findSeen(q: ReminderWindow): Promise<Proposal[]> {
    const docs = await ProposalModel.find({
      status: 'SENT',
      firstSeenAt: { $lt: q.before, $gt: q.after },
    })
      .sort({ firstSeenAt: 1 })
      .limit(q.limit);
    return docs.map(toEntity);
  }

  async list(filter: ProposalListFilter): Promise<{ items: Proposal[]; total: number }> {
    const query: Record<string, unknown> = {};
    if (filter.leadId) {
      if (!isValidObjectId(filter.leadId)) return { items: [], total: 0 };
      query['leadId'] = filter.leadId;
    }
    if (filter.status) query['status'] = filter.status;
    if (filter.createdById) query['createdById'] = filter.createdById;

    const [docs, total] = await Promise.all([
      ProposalModel.find(query)
        .sort({ createdAt: -1 })
        .skip((filter.page - 1) * filter.pageSize)
        .limit(filter.pageSize),
      ProposalModel.countDocuments(query),
    ]);
    return { items: docs.map(toEntity), total };
  }
}
